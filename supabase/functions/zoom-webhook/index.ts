// Supabase Edge Function: zoom-webhook
// Receives Zoom Phone call events and logs them to the database.
// Deploy with: supabase functions deploy zoom-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ZOOM_WEBHOOK_SECRET = Deno.env.get('ZOOM_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/** HMAC-SHA256 using Deno's native Web Crypto API (no imports needed) */
async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Verify Zoom webhook HMAC-SHA256 signature */
async function verifyZoomSignature(
  payload: string,
  timestamp: string,
  signature: string,
): Promise<boolean> {
  const message = `v0:${timestamp}:${payload}`
  const hash = await hmacHex(ZOOM_WEBHOOK_SECRET, message)
  return `v0=${hash}` === signature
}

/** Find a client by phone number (tries multiple formats) */
async function findClientByPhone(phone: string): Promise<string | null> {
  const cleaned = phone.replace(/\D/g, '')
  const variants = [phone, `+${cleaned}`, cleaned]
  for (const variant of variants) {
    const { data } = await supabase
      .from('clients')
      .select('id')
      .ilike('phone', `%${variant}%`)
      .limit(1)
      .maybeSingle()
    if (data) return data.id
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const body = await req.text()
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // ── Zoom URL validation challenge (CRC) ──
  // Zoom sends this when you first enter the URL, or click "Validate"
  if (payload.event === 'endpoint.url_validation') {
    const plainToken = (payload.payload as Record<string, string>).plainToken
    const encryptedToken = await hmacHex(ZOOM_WEBHOOK_SECRET, plainToken)
    return new Response(
      JSON.stringify({ plainToken, encryptedToken }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    )
  }

  // ── Verify signature on all other events ──
  const timestamp = req.headers.get('x-zm-request-timestamp') ?? ''
  const signature = req.headers.get('x-zm-signature') ?? ''
  const valid = await verifyZoomSignature(body, timestamp, signature)
  if (!valid) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Handle call events ──
  const event = payload.event as string
  const callObj = (payload.payload as Record<string, unknown>)?.object as Record<string, unknown>

  if (!callObj || (event !== 'phone.call_ended' && event !== 'phone.callee_missed')) {
    return new Response('OK', { status: 200 })
  }

  const zoomCallId = callObj.call_id as string
  const direction = callObj.direction === 'inbound' ? 'inbound' : 'outbound'
  const duration = (callObj.duration as number) ?? 0
  const callStatus = event === 'phone.callee_missed' ? 'missed' : 'answered'

  const callee = callObj.callee as Record<string, string> | undefined
  const caller = callObj.caller as Record<string, string> | undefined
  const externalPhone = direction === 'outbound'
    ? callee?.phone_number
    : caller?.phone_number

  if (!externalPhone) {
    return new Response('OK', { status: 200 })
  }

  const clientId = await findClientByPhone(externalPhone)
  if (clientId) {
    await supabase.from('call_logs').upsert({
      client_id: clientId,
      zoom_call_id: zoomCallId,
      direction,
      duration,
      call_status: callStatus,
      created_at: new Date().toISOString(),
    }, { onConflict: 'zoom_call_id' })

    await supabase.from('clients')
      .update({ last_call_date: new Date().toISOString() })
      .eq('id', clientId)
  }

  return new Response('OK', { status: 200 })
})
