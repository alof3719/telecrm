import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, User, RefreshCw, Pencil, Check, X } from 'lucide-react'
import dayjs from 'dayjs'

function NameCell({ profile, currentUserId }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(profile.full_name || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('profiles').update({ full_name: val.trim() || null }).eq('id', profile.id)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(profile.full_name || ''); setEditing(false) } }}
          placeholder="Enter name…"
          style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--text)', outline: 'none', width: 160 }}
        />
        <button onClick={save} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', padding: 2 }}>
          <Check size={15} />
        </button>
        <button onClick={() => { setVal(profile.full_name || ''); setEditing(false) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
          <X size={15} />
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, border: '1px solid transparent', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-subtle, rgba(0,0,0,0.04))' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}
      title="Click to edit name"
    >
      <span style={{ fontWeight: 500, fontSize: 13 }}>
        {profile.full_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 400 }}>No name set</span>}
      </span>
      <Pencil size={11} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
    </div>
  )
}

export default function UsersPage({ session }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => { fetchProfiles() }, [])

  async function fetchProfiles() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    setProfiles(data || [])
    setLoading(false)
  }

  async function toggleRole(profile) {
    const newRole = profile.role === 'admin' ? 'user' : 'admin'
    if (profile.id === session.user.id && newRole === 'user') {
      alert("You can't remove your own admin role.")
      return
    }
    setUpdating(profile.id)
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id)
    if (!error) setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: newRole } : p))
    setUpdating(null)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-subtitle">{profiles.length} user{profiles.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-ghost" onClick={fetchProfiles}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <NameCell profile={p} currentUserId={session.user.id} />
                        {p.id === session.user.id && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(you)</span>
                        )}
                      </div>
                    </td>
                    <td className="text-muted" style={{ fontSize: 13 }}>{p.email}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        background: p.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.15)',
                        color: p.role === 'admin' ? '#818cf8' : 'var(--text-muted)',
                      }}>
                        {p.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                        {p.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="text-muted text-sm">{dayjs(p.created_at).format('MMM D, YYYY')}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleRole(p)}
                        disabled={updating === p.id}
                        style={{ minWidth: 130 }}
                      >
                        {updating === p.id ? 'Saving…' : p.role === 'admin' ? '↓ Remove Admin' : '↑ Make Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Shield size={18} style={{ color: '#818cf8', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Admin vs User permissions</div>
            <div className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
              <strong>Admins</strong> can add, edit, and <strong>delete</strong> clients, manage user roles, and import CSV leads.<br />
              <strong>Users</strong> can add and edit clients, add notes, log calls, and change statuses — but cannot delete clients or manage other users.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
