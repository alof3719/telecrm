import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import StatusBadge, { STATUS_LABELS } from './StatusBadge'
import { getClientLocalTime, getTimezoneLabel } from '../lib/timezones'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { X, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Trash2, CalendarDays } from 'lucide-react'

dayjs.extend(relativeTime)

const STATUSES = Object.keys(STATUS_LABELS)

function formatDuration(seconds) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function CallItem({ call }) {
  const isOutbound = call.direction === 'outbound'
  const isMissed = call.call_status === 'missed'
  const iconClass = isMissed ? 'missed' : isOutbound ? 'outbound' : 'inbound'
  const Icon = isMissed ? PhoneMissed : isOutbound ? PhoneOutgoing : PhoneIncoming

  return (
    <div className="call-item">
      <div className={`call-icon ${iconClass}`}>
        <Icon size={16} />
      </div>
      <div className="call-meta">
        <div>
          <span className="call-duration">{formatDuration(call.duration)}</span>
          {' · '}
          <span style={{ textTransform: 'capitalize', fontSize: 13 }}>
            {call.call_status || call.direction}
          </span>
        </div>
        <div className="call-time">{dayjs(call.created_at).format('MMM D, YYYY h:mm A')} · {dayjs(call.created_at).fromNow()}</div>
      </div>
    </div>
  )
}

export default function ClientModal({ client: initialClient, onClose, onUpdate, onDelete, session, isAdmin }) {
  const [client, setClient] = useState(initialClient)
  const [tab, setTab] = useState('info')
  const [notes, setNotes] = useState([])
  const [calls, setCalls] = useState([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ ...initialClient })
  const [deleting, setDeleting] = useState(false)
  const [followupEditing, setFollowupEditing] = useState(false)
  const [followupVal, setFollowupVal] = useState(initialClient.next_followup_date || '')

  const localTime = getClientLocalTime(client.phone)
  const city = getTimezoneLabel(client.phone)

  useEffect(() => {
    fetchNotes()
    fetchCalls()
  }, [client.id])

  async function fetchNotes() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }

  async function fetchCalls() {
    const { data } = await supabase
      .from('call_logs')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setCalls(data || [])
  }

  async function handleStatusChange(newStatus) {
    const { data, error } = await supabase
      .from('clients')
      .update({ status: newStatus })
      .eq('id', client.id)
      .select()
      .single()
    if (!error) {
      setClient(data)
      onUpdate(data)
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('notes').insert({
      client_id: client.id,
      content: newNote.trim(),
      created_by: session.user.email,
    }).select().single()
    if (!error) {
      setNotes([data, ...notes])
      setNewNote('')
      // Update last_comment_date
      await supabase.from('clients')
        .update({ last_comment_date: new Date().toISOString() })
        .eq('id', client.id)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${client.name}"? This cannot be undone.`)) return
    setDeleting(true)
    const { error } = await supabase.from('clients').delete().eq('id', client.id)
    if (!error) {
      onDelete(client.id)
      onClose()
    } else {
      alert('Delete failed: ' + error.message)
    }
    setDeleting(false)
  }

  async function handleSaveFollowup(val) {
    const { data, error } = await supabase
      .from('clients')
      .update({ next_followup_date: val || null })
      .eq('id', client.id)
      .select()
      .single()
    if (!error) {
      setClient(data)
      setForm(data)
      onUpdate(data)
      setFollowupVal(val)
    }
    setFollowupEditing(false)
  }

  async function handleSaveInfo() {
    setSaving(true)
    const { data, error } = await supabase
      .from('clients')
      .update({
        name: form.name,
        phone: form.phone,
        email: form.email,
        company_name: form.company_name,
        deal_value: form.deal_value || null,
        assigned_to: form.assigned_to,
        next_followup_date: form.next_followup_date || null,
      })
      .eq('id', client.id)
      .select()
      .single()
    if (!error) {
      setClient(data)
      setForm(data)
      onUpdate(data)
      setEditMode(false)
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">{client.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <StatusBadge status={client.status} />
              {localTime && (
                <span className="time-badge">
                  <Clock size={12} />
                  <span className="city">{city}</span>
                  {localTime}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={`zoomphoneapp://call?number=${encodeURIComponent(client.phone)}`}
              className="btn btn-primary btn-sm"
              title="Call with Zoom Phone"
            >
              <Phone size={14} /> Call
            </a>
            <button className="btn btn-icon btn-ghost" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 24px' }}>
          <div className="tabs">
            {['info', 'notes', 'calls'].map(t => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'notes' && notes.length > 0 && ` (${notes.length})`}
                {t === 'calls' && calls.length > 0 && ` (${calls.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* ── INFO TAB ── */}
          {tab === 'info' && (
            <div>
              {/* Status change */}
              <div className="form-group">
                <label>Pipeline Status</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      className={`status-badge status-${s}`}
                      style={{ cursor: 'pointer', border: client.status === s ? '2px solid currentColor' : '2px solid transparent' }}
                      onClick={() => handleStatusChange(s)}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {editMode ? (
                <div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Name *</label>
                      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Phone * {!isAdmin && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(admin only)</span>}</label>
                      <input
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        disabled={!isAdmin}
                        style={!isAdmin ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email {!isAdmin && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(admin only)</span>}</label>
                      <input
                        value={form.email || ''}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        disabled={!isAdmin}
                        style={!isAdmin ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      />
                    </div>
                    <div className="form-group">
                      <label>Company</label>
                      <input value={form.company_name || ''} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Deal Value ($)</label>
                      <input type="number" value={form.deal_value || ''} onChange={e => setForm({ ...form, deal_value: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Assigned To</label>
                      <input value={form.assigned_to || ''} onChange={e => setForm({ ...form, assigned_to: e.target.value })} placeholder="email@example.com" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Next Follow-up Date</label>
                    <input type="date" value={form.next_followup_date || ''} onChange={e => setForm({ ...form, next_followup_date: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                  {[
                    ['Phone', client.phone],
                    ['Email', client.email || '—'],
                    ['Company', client.company_name || '—'],
                    ['Assigned To', client.assigned_to || '—'],
                    ['Deal Value', client.deal_value ? `$${Number(client.deal_value).toLocaleString()}` : '—'],
                    ['Last Call', client.last_call_date ? dayjs(client.last_call_date).format('MMM D, YYYY h:mm A') : '—'],
                    ['Last Comment', client.last_comment_date ? dayjs(client.last_comment_date).fromNow() : '—'],
                    ['Created', dayjs(client.created_at).format('MMM D, YYYY')],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-muted text-sm">{k}</div>
                      <div style={{ fontWeight: 500, marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                  {/* Inline editable follow-up */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div className="text-muted text-sm" style={{ marginBottom: 4 }}>Next Follow-up</div>
                    {followupEditing ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="date"
                          autoFocus
                          value={followupVal}
                          onChange={e => setFollowupVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveFollowup(followupVal); if (e.key === 'Escape') setFollowupEditing(false) }}
                          style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveFollowup(followupVal)}>Save</button>
                        {followupVal && <button className="btn btn-ghost btn-sm" onClick={() => handleSaveFollowup('')}>Clear</button>}
                        <button className="btn btn-ghost btn-sm" onClick={() => setFollowupEditing(false)}>Cancel</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => setFollowupEditing(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 12px', borderRadius: 7, border: '1px dashed var(--border)', background: 'var(--bg-subtle, rgba(0,0,0,0.03))', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        title="Click to set follow-up date"
                      >
                        <CalendarDays size={14} style={{ color: 'var(--accent)' }} />
                        <span style={{
                          fontWeight: 500,
                          color: client.next_followup_date
                            ? (client.next_followup_date < dayjs().format('YYYY-MM-DD') ? 'var(--danger)' : client.next_followup_date === dayjs().format('YYYY-MM-DD') ? 'var(--warning)' : 'inherit')
                            : 'var(--text-muted)',
                        }}>
                          {client.next_followup_date ? dayjs(client.next_followup_date).format('MMM D, YYYY') : 'Set follow-up date…'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── NOTES TAB ── */}
          {tab === 'notes' && (
            <div>
              <div className="form-group">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleAddNote()}
                />
                <button
                  className="btn btn-primary btn-sm mt-2"
                  onClick={handleAddNote}
                  disabled={saving || !newNote.trim()}
                >
                  {saving ? 'Saving…' : 'Add Note (Ctrl+Enter)'}
                </button>
              </div>
              {notes.length === 0 ? (
                <div className="empty-state"><p>No notes yet</p></div>
              ) : (
                notes.map(n => (
                  <div key={n.id} className="note-item">
                    <div className="note-meta">
                      {n.created_by} · {dayjs(n.created_at).format('MMM D, YYYY h:mm A')} · {dayjs(n.created_at).fromNow()}
                    </div>
                    <div className="note-content">{n.content}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── CALLS TAB ── */}
          {tab === 'calls' && (
            <div>
              {calls.length === 0 ? (
                <div className="empty-state">
                  <Phone size={32} />
                  <p>No calls logged yet</p>
                  <p className="text-sm mt-2">Calls made via Zoom Phone will appear here automatically.</p>
                </div>
              ) : (
                calls.map(c => <CallItem key={c.id} call={c} />)
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {tab === 'info' && (
            editMode ? (
              <>
                <button className="btn btn-ghost" onClick={() => { setEditMode(false); setForm(client) }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveInfo} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setEditMode(true)}>Edit Client</button>
            )
          )}
          {isAdmin && !editMode && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)', marginLeft: 'auto' }}
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
