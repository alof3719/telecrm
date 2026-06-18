import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { clients, companyId } = req.body
  if (!clients || !Array.isArray(clients)) return res.status(400).json({ error: 'clients array required' })

  const results = []

  for (const client of clients) {
    if (!client.email) {
      results.push({ name: client.name, email: null, success: false, error: 'No email' })
      continue
    }

    try {
      // Create or get auth user
      let userId = null
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: client.email,
        password: '123123',
        email_confirm: true,
      })

      if (createErr) {
        if (createErr.message?.toLowerCase().includes('already been registered') ||
            createErr.message?.toLowerCase().includes('already exists')) {
          // User exists — look up their ID
          const { data: { users } } = await supabase.auth.admin.listUsers()
          const existing = users?.find(u => u.email?.toLowerCase() === client.email.toLowerCase())
          userId = existing?.id || null
          // Update their password to 123123
          if (userId) {
            await supabase.auth.admin.updateUserById(userId, { password: '123123' })
          }
        } else {
          throw createErr
        }
      } else {
        userId = created?.user?.id || null
      }

      // Set profile role to 'client' and link company
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          email: client.email,
          role: 'client',
          company_id: companyId || null,
        }, { onConflict: 'id' })
      }

      // Upsert trading account
      const { error: accErr } = await supabase.from('trading_accounts').upsert({
        user_id: userId,
        email: client.email,
        company_id: companyId || null,
        balance: 100,
      }, { onConflict: 'email' })

      if (accErr) throw accErr

      results.push({ name: client.name, email: client.email, success: true })
    } catch (e) {
      results.push({ name: client.name, email: client.email, success: false, error: e.message })
    }
  }

  return res.json({ results })
}
