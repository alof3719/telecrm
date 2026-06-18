import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Settings, Plus, Edit2, X, UserPlus, Mail } from 'lucide-react'

const fmtUSD = (n) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function AccountModal({ account, users, companyId, onClose, onSaved }) {
  const [userId, setUserId] = useState(account?.user_id || '')
  const [balance, setBalance] = useState(account?.balance ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!userId) { setError('Select a user.'); return }
    const bal = parseFloat(balance)
    if (isNaN(bal) || bal < 0) { setError('Enter a valid balance.'); return }
    setSaving(true)
    setError('')
    try {
      const user = users.find(u => u.id === userId)
      if (account) {
        const { error } = await supabase
          .from('trading_accounts')
          .update({ balance: bal })
          .eq('id', account.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('trading_accounts')
          .insert({ user_id: userId, email: user?.email, company_id: companyId, balance: bal })
        if (error) throw error
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>{account ? 'Edit Account' : 'Create Trading Account'}</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
          <div>
            <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>User</label>
            {account ? (
              <div style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', background: 'var(--bg)' }}>
                {account.email}
              </div>
            ) : (
              <select value={userId} onChange={e => setUserId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Select user…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Balance (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="e.g. 10000"
              style={{ width: '100%' }}
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

function InviteClientModal({ companyId, onClose, onSaved }) {
  const [email, setEmail] = useState('')
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleInvite() {
    if (!email.trim()) { setError('Enter an email address.'); return }
    const bal = parseFloat(balance)
    if (isNaN(bal) || bal < 0) { setError('Enter a valid starting balance.'); return }
    setSaving(true); setError('')
    try {
      // Create pending trading account (user_id null until client logs in)
      const { error: accErr } = await supabase.from('trading_accounts').insert({
        email: email.trim().toLowerCase(),
        company_id: companyId,
        balance: bal,
      })
      if (accErr) throw accErr

      // Send magic link login email
      const { error: authErr } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      })
      if (authErr) throw authErr

      setSuccess(`Invite sent to ${email}. They'll receive a login link by email.`)
      setEmail(''); setBalance('')
      onSaved()
    } catch (e) {
      setError(e.message || 'Invite failed.')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>Invite Client</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
          <div style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1d4ed8' }}>
            <Mail size={13} style={{ display: 'inline', marginRight: 6 }} />
            The client will receive an email with a magic link to log in. Their account will be set up automatically.
          </div>
          <div>
            <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Client Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="client@example.com" style={{ width: '100%' }} />
          </div>
          <div>
            <label className="text-muted text-sm" style={{ display: 'block', marginBottom: 4 }}>Starting Balance (USD)</label>
            <input type="number" min="0" step="0.01" value={balance}
              onChange={e => setBalance(e.target.value)} placeholder="e.g. 10000" style={{ width: '100%' }} />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
          {success && <div style={{ color: 'var(--success)', fontSize: 13, background: '#f0fdf4', padding: '8px 12px', borderRadius: 6 }}>{success}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            {!success && (
              <button className="btn btn-primary" onClick={handleInvite} disabled={saving}>
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TradingAdmin({ session, companyId }) {
  const [accounts, setAccounts] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editAccount, setEditAccount] = useState(null)
  const [showInvite, setShowInvite] = useState(false)

  async function fetchData() {
    const [{ data: accs }, { data: profs }] = await Promise.all([
      supabase.from('trading_accounts').select('*').order('email'),
      supabase.from('profiles').select('id, email').order('email'),
    ])
    setAccounts(accs || [])
    const existingIds = new Set((accs || []).map(a => a.user_id))
    setUsers((profs || []).filter(p => !existingIds.has(p.id)))
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowInvite(true)}>
            <UserPlus size={14} /> Invite Client
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Existing User
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
        {accounts.length === 0 ? (
          <div className="text-muted text-sm" style={{ padding: 24, textAlign: 'center' }}>
            No trading accounts yet. Create one to get started.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                {['User', 'Balance', 'Created', ''].map(h => (
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
        <AccountModal account={editAccount} users={users} companyId={companyId}
          onClose={() => setShowModal(false)} onSaved={fetchData} />
      )}
      {showInvite && (
        <InviteClientModal companyId={companyId}
          onClose={() => setShowInvite(false)} onSaved={fetchData} />
      )}
    </div>
  )
}
