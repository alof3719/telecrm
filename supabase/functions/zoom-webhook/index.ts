// Supabase Edge Function: zoom-webhook
// Receives Zoom Phone call events and logs them to the database.
// Deploy with: supabase functions deploy zoom-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

const ZOOM_WEBHOOK_SECRET = Deno.env.get('ZOOM_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

/**
 * Verify Zoom webhook signature
 * Zoom signs each request with HMAC-SHA256
 */
function verifyZoomSignature(
  payload: string,
  timestamp: string,
  signature: string,
): boolean {
  const message = `v0:${timestamp}:${payload}`
  const hash = createHmac('sha256', ZOOM_WEBHOOK_SECRET)
    .update(message)
    .digest('hex')
  return `v0=${hash}` === signature
}

/**
 * Find a client by phone number (tries multiple formats)
 */
async function findClientByPhone(phone: string): Promise<string | null> {
  const cleaned = phone.replace(/\D/g, '')
  const variants = [
    phone,
    `+${cleaned}`,
    cleaned,
    cleaned.replace(/^1/, '+1'),
  ]
  for (const variant of variants) {
    const { data } = await supabase
      .from('clients')
      .select('id')
      .ilike('phone', `%${variant}%`)
      .limit(1)
      .single()
    if (data) return data.id
  }
  return null
}

Deno.serve(async (req: Request) => {
  // Handle Zoom URL validation challenge
  if (req.method === 'POST') {
    const body = await req.text()
    const payload = JSON.parse(body)

    // Zoom endpoint validation handshake
    if (payload.event === 'endpoint.url_validation') {
      const hashForValidate = createHmac('sha256', ZOOM_WEBHOOK_SECRET)
        .update(payload.payload.plainToken)
        .digest('hex')
      return new Response(
        JSON.stringify({
          plainToken: payload.payload.plainToken,
          encryptedToken: hashForValidate,
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Verify signature for all other events
    const timestamp = req.headers.get('x-zm-request-timestamp') ?? ''
    const signature = req.headers.get('x-zm-signature') ?? ''
    if (!verifyZoomSignature(body, timestamp, signature)) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Handle call events
    // Zoom Phone events: phone.callee_answered, phone.caller_ringing, phone.call_ended
    const event = payload.event
    const callObj = payload.payload?.object

    if (!callObj) {
      return new Response('OK', { status: 200 })
    }

    // We care about call_ended to log duration, or missed calls
    if (event === 'phone.call_ended' || event === 'phone.callee_missed') {
      const zoomCallId = callObj.call_id
      const direction = callObj.direction === 'inbound' ? 'inbound' : 'outbound'
      const duration = callObj.duration ?? 0 // seconds
      const callStatus = event === 'phone.callee_missed' ? 'missed' : 'answered'

      // Determine the client phone number
      const externalPhone = direction === 'outbound'
        ? callObj.callee?.phone_number
        : callObj.caller?.phone_number

      if (!externalPhone) {
        return new Response('OK', { status: 200 })
      }

      const clientId = await findClientByPhone(externalPhone)

      if (clientId) {
        // Upsert call log (zoom_call_id is unique, prevents duplicates)
        const { error: logError } = await supabase.from('call_logs').upsert({
          client_id: clientId,
          zoom_call_id: zoomCallId,
          direction,
          duration,
          call_status: callStatus,
          created_at: new Date().toISOString(),
        }, { onConflict: 'zoom_call_id' })

        if (!logError) {
          // Update last_call_date on the client
          await supabase.from('clients').update({
            last_call_date: new Date().toISOString(),
          }).eq('id', clientId)
        }
      }
    }

    return new Response('OK', { status: 200 })
  }

  return new Response('Method Not Allowed', { status: 405 })
})
