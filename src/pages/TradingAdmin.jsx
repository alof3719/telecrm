import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Settings, Users, Edit2, X, CheckCircle, AlertCircle } from 'lucide-react'

const fmtUSD = (n) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function EditBalanceModal({ account, onClose, onSaved }) {
  const [balance, setBalance] = useState(account.balance ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const bal = parseFloat(balance)
    if (isNaN(bal) || bal < 0) { setError('Enter a valid balance.'); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('trading_accounts').update({ balance: bal }).eq('id', account.id)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h2>Edit Balance</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{account.email}</div>
          <div>
            <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>New Balance (USD)</label>
            <input type="number" min="0" step="0.01" value={balance}
              onChange={e => setBalance(e.target.value)} style={{ width: '100%' }} />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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

function SetupResultsModal({ results, onClose }) {
  const ok = results.filter(r => r.success)
  const fail = results.filter(r => !r.success)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>Setup Complete</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gain)' }}>{ok.length}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Accounts created</div>
            </div>
            {fail.length > 0 && (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--loss)' }}>{fail.length}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Skipped</div>
              </div>
            )}
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                {r.success
                  ? <CheckCircle size={14} color="var(--gain)" />
                  : <AlertCircle size={14} color="var(--loss)" />}
                <span style={{ flex: 1 }}>{r.name} {r.email ? `(${r.email})` : ''}</span>
                {!r.success && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.error}</span>}
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
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
  const [editAccount, setEditAccount] = useState(null)
  const [settingUp, setSettingUp] = useState(false)
  const [setupResults, setSetupResults] = useState(null)

  async function fetchData() {
    const [{ data: accs }, { data: leads }] = await Promise.all([
      supabase.from('trading_accounts').select('*').order('email'),
      supabase.from('clients').select('id, name, email').order('name'),
    ])
    setAccounts(accs || [])
    setClients(leads || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  async function handleSetupAll() {
    const clientsWithEmail = clients.filter(c => c.email)
    if (clientsWithEmail.length === 0) {
      alert('No clients with email addresses found. Add emails to your clients first.')
      return
    }
    setSettingUp(true)
    try {
      const res = await fetch('/api/create-trading-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients, companyId }),
      })
      const { results, error } = await res.json()
      if (error) throw new Error(error)
      setSetupResults(results)
      await fetchData()
    } catch (e) {
      alert('Setup failed: ' + e.message)
    } finally {
      setSettingUp(false)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const clientsWithEmail = clients.filter(c => c.email)
  const clientsWithoutEmail = clients.filter(c => !c.email)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Settings size={20} color="var(--primary)" />
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Trading Accounts</h1>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={handleSetupAll}
          disabled={settingUp || clientsWithEmail.length === 0}
        >
          <Users size={14} />
          {settingUp ? 'Setting up…' : `Setup All Clients (${clientsWithEmail.length})`}
        </button>
      </div>

      {/* Info box */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#1d4ed8' }}>
        Clicking <strong>Setup All Clients</strong> will create a login account for every client with an email address (password: <strong>123123</strong>) and assign them <strong>$100</strong> starting balance. Already-existing accounts are updated, not duplicated.
        {clientsWithoutEmail.length > 0 && (
          <div style={{ marginTop: 6, color: '#92400e' }}>
            ⚠ {clientsWithoutEmail.length} client{clientsWithoutEmail.length > 1 ? 's' : ''} have no email and will be skipped.
          </div>
        )}
      </div>

      {/* Accounts table */}
      <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
        {accounts.length === 0 ? (
          <div className="text-muted text-sm" style={{ padding: 24, textAlign: 'center' }}>
            No trading accounts yet. Click "Setup All Clients" to create them.
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
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditAccount(acc)}>
                      <Edit2 size={13} /> Edit Balance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editAccount && (
        <EditBalanceModal account={editAccount} onClose={() => setEditAccount(null)} onSaved={fetchData} />
      )}
      {setupResults && (
        <SetupResultsModal results={setupResults} onClose={() => setSetupResults(null)} />
      )}
    </div>
  )
}
