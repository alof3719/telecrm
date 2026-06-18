// Auto-creates trading accounts for clients that have an email.
// Silently skips clients without email. Fires-and-forgets — doesn't block the UI.
export async function autoSetupTradingAccounts(clients, companyId) {
  const withEmail = (Array.isArray(clients) ? clients : [clients]).filter(c => c.email)
  if (withEmail.length === 0) return

  try {
    await fetch('/api/create-trading-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clients: withEmail, companyId }),
    })
  } catch (e) {
    console.error('autoSetupTradingAccounts failed:', e)
  }
}
