import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, User, RefreshCw } from 'lucide-react'
import dayjs from 'dayjs'

export default function UsersPage({ session }) {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null) // id of user being updated

  useEffect(() => {
    fetchProfiles()
  }, [])

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
    // Prevent removing your own admin
    if (profile.id === session.user.id && newRole === 'user') {
      alert("You can't remove your own admin role.")
      return
    }
    setUpdating(profile.id)
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profile.id)
    if (!error) {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: newRole } : p))
    }
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
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>
                      {p.email}
                      {p.id === session.user.id && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(you)</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: p.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.15)',
                        color: p.role === 'admin' ? '#818cf8' : 'var(--text-muted)',
                      }}>
                        {p.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                        {p.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="text-muted text-sm">
                      {dayjs(p.created_at).format('MMM D, YYYY')}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleRole(p)}
                        disabled={updating === p.id}
                        style={{ minWidth: 130 }}
                      >
                        {updating === p.id
                          ? 'Saving…'
                          : p.role === 'admin'
                            ? '↓ Remove Admin'
                            : '↑ Make Admin'}
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
