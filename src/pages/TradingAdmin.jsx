import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Settings, Plus, Edit2, X } from 'lucide-react'

const fmtUSD = (n) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function AccountModal({ account, clients, companyId, onClose, onSaved }) {
  const [clientId, setClientId] = useState('')
  const [balance, setBalance] = useState(account?.balance ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedClient = clients.find(c => c.id === clientId)

  async function handleSave() {
    const bal = parseFloat(balance)
    if (isNaN(bal) || bal < 0) { setError('Enter a valid balance.'); return }

    if (!account && !clientId) { setError('Select a client.'); return }

    setSaving(true); setError('')
    try {
      if (account) {
        const { error } = await supabase
          .from('trading_accounts')
          .update({ balance: bal })
          .eq('id', account.id)
        if (error) throw error
      } else {
        const email = selectedClient?.email
        if (!email) { setError('Selected client has no email.'); setSaving(false); return }
        const { error } = await supabase
          .from('trading_accounts')
          .insert({ email, company_id: companyId, balance: bal })
        if (error) throw error
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message || 'Save failed.')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>{account ? 'Edit Account' : 'Add Trading Account'}</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
          <div>
            <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Client</label>
            {account ? (
              <div style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', background: 'var(--bg)' }}>
                {account.email}
              </div>
            ) : (
              <>
                <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select client from leads…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.email ? ` — ${c.email}` : ' (no email)'}
                    </option>
                  ))}
                </select>
                {selectedClient && !selectedClient.email && (
                  <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                    This client has no email on file. Add one in the Clients page first.
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Starting Balance (USD)</label>
            <input
              type="number" min="0" step="0.01"
              value={balance} onChange={e => setBalance(e.target.value)}
              placeholder="e.g. 10000" style={{ width: '100%' }}
            />
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TradingAdmin({ session, companyId }) {
  const [accounts, setAccounts] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editAccount, setEditAccount] = useState(null)

  async function fetchData() {
    const [{ data: accs }, { data: leads }] = await Promise.all([
      supabase.from('trading_accounts').select('*').order('email'),
      supabase.from('clients').select('id, name, email').order('name'),
    ])
    setAccounts(accs || [])
    // Only show clients who don't already have a trading account
    const existingEmails = new Set((accs || []).map(a => a.email?.toLowerCase()).filter(Boolean))
    setClients((leads || []).filter(c => !existingEmails.has(c.email?.toLowerCase())))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  function openCreate() { setEditAccount(null); setShowModal(true) }
  function openEdit(acc) { setEditAccount(acc); setShowModal(true) }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Settings size={20} color="var(--primary)" />
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Trading Accounts</h1>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={openCreate}>
          <Plus size={14} /> Existing Client
        </button>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
        {accounts.length === 0 ? (
          <div className="text-muted text-sm" style={{ padding: 24, textAlign: 'center' }}>
            No trading accounts yet. Add one to get started.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                {['Client', 'Balance', 'Created', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{acc.email}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>{fmtUSD(acc.balance)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                    {new Date(acc.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(acc)}>
                      <Edit2 size={13} /> Edit Balance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AccountModal
          account={editAccount}
          clients={clients}
          companyId={companyId}
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  )
}
