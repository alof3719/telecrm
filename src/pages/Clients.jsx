import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import ClientModal from '../components/ClientModal'
import AddClientForm from '../components/AddClientForm'
import { getClientLocalTime, getTimezoneLabel } from '../lib/timezones'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { Plus, Search, Phone, Clock, ChevronUp, ChevronDown, Upload, Download, X, CheckCircle, Send, Settings2 } from 'lucide-react'

function WhatsAppIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

function whatsappUrl(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  return `https://wa.me/${digits}`
}

const ALL_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'in_the_money', label: '💰 In The Money' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'monkey', label: '🐒 Monkey' },
  { value: 'broke', label: 'Broke' },
]

// Map flexible CSV column headers → our field names
const COLUMN_MAP = {
  name: ['name', 'full name', 'fullname', 'contact', 'contact name'],
  phone: ['phone', 'phone number', 'tel', 'telephone', 'mobile', 'cell'],
  email: ['email', 'email address', 'e-mail'],
  company_name: ['company', 'company name', 'business', 'organization', 'organisation'],
  deal_value: ['deal', 'deal value', 'value', 'amount', 'price'],
  assigned_to: ['assigned', 'assigned to', 'rep', 'sales rep', 'agent'],
  notes: ['notes', 'note', 'comments', 'comment', 'description'],
  next_followup_date: ['followup', 'follow up', 'follow-up date', 'next followup', 'next follow-up'],
}

// ── Column definitions & persistence ──────────────────────────────────────────
const COLUMN_DEFS = [
  { key: 'name',               label: 'Name',        sortKey: 'name' },
  { key: 'phone',              label: 'Phone',       sortKey: null },
  { key: 'call',               label: '',            sortKey: null },
  { key: 'last_note',          label: 'Last Note',   sortKey: null },
  { key: 'add_note',           label: 'Add Note',    sortKey: null },
  { key: 'company_name',       label: 'Company',     sortKey: 'company_name' },
  { key: 'status',             label: 'Status',      sortKey: 'status' },
  { key: 'client_time',        label: 'Client Time', sortKey: null },
  { key: 'deal_value',         label: 'Deal',        sortKey: 'deal_value' },
  { key: 'next_followup_date', label: 'Follow-up',   sortKey: 'next_followup_date' },
  { key: 'assigned_to',        label: 'Assigned',    sortKey: 'assigned_to' },
].map(c => ({ ...c, visible: true }))

const COL_STORAGE = 'telecrm_cols_v1'

function loadColumnPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(COL_STORAGE) || 'null')
    if (!saved) return COLUMN_DEFS
    // Merge: respect saved order + visibility, add any new cols at end
    const savedMap = Object.fromEntries(saved.map(c => [c.key, c]))
    const merged = saved
      .map(s => { const def = COLUMN_DEFS.find(d => d.key === s.key); return def ? { ...def, visible: s.visible } : null })
      .filter(Boolean)
    COLUMN_DEFS.forEach(d => { if (!savedMap[d.key]) merged.push(d) })
    return merged
  } catch { return COLUMN_DEFS }
}

function saveColumnPrefs(cols) {
  localStorage.setItem(COL_STORAGE, JSON.stringify(cols.map(c => ({ key: c.key, visible: c.visible }))))
}

// ── Column organizer dropdown ──────────────────────────────────────────────────
function ColumnOrganizer({ columns, onChange }) {
  const [open, setOpen] = useState(false)

  function toggle(key) {
    onChange(columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c))
  }
  function move(i, dir) {
    const next = [...columns]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  function reset() { onChange(COLUMN_DEFS) }

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)} title="Customize columns" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Settings2 size={14} /> Columns
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)', padding: '8px 0', minWidth: 210,
          }}>
            <div style={{ padding: '4px 14px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Show / reorder columns
            </div>
            {columns.map((col, i) => (
              <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', background: 'transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle, rgba(0,0,0,0.04))'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <input type="checkbox" checked={col.visible} onChange={() => toggle(col.key)}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent)', width: 14, height: 14 }} />
                <span style={{ flex: 1, fontSize: 13, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggle(col.key)}>
                  {col.label || 'Call button'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <button onClick={() => move(i, -1)} disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--text-muted)', padding: '0 3px', fontSize: 10, lineHeight: 1, opacity: i === 0 ? 0.25 : 0.7 }}>▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === columns.length - 1}
                    style={{ background: 'none', border: 'none', cursor: i === columns.length - 1 ? 'default' : 'pointer', color: 'var(--text-muted)', padding: '0 3px', fontSize: 10, lineHeight: 1, opacity: i === columns.length - 1 ? 0.25 : 0.7 }}>▼</button>
                </div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, padding: '8px 14px 2px' }}>
              <button onClick={reset} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                Reset to default
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function matchHeader(h) {
  const lower = h.trim().toLowerCase()
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    if (aliases.includes(lower)) return field
  }
  return null
}

function LocalTimeBadge({ phone }) {
  const [time, setTime] = useState(() => getClientLocalTime(phone))
  const city = getTimezoneLabel(phone)

  useEffect(() => {
    const id = setInterval(() => setTime(getClientLocalTime(phone)), 30000)
    return () => clearInterval(id)
  }, [phone])

  if (!time) return <span className="text-muted text-sm">—</span>
  return (
    <span className="time-badge">
      <Clock size={11} />
      <span className="city">{city}</span>
      {time}
    </span>
  )
}

function ImportModal({ session, companyId, onClose, onImported }) {
  const [step, setStep] = useState('upload') // 'upload' | 'preview' | 'importing' | 'done'
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [errors, setErrors] = useState([])
  const [imported, setImported] = useState(0)
  const [failed, setFailed] = useState(0)
  const fileRef = useRef()

  function downloadTemplate() {
    const csv = 'name,phone,email,company,deal_value,assigned_to,notes,next_followup_date\nJohn Smith,+12125551234,john@acme.com,Acme Corp,5000,rep@yourteam.com,Interested in package A,2024-12-01\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(file) {
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        // Build column mapping from headers
        const m = {}
        meta.fields.forEach(h => {
          const field = matchHeader(h)
          if (field) m[h] = field
        })
        setMapping(m)
        setRows(data)
        setStep('preview')
      },
    })
  }

  async function handleImport() {
    setStep('importing')
    const records = rows.map(row => {
      const r = { status: 'new', company_id: companyId }
      Object.entries(mapping).forEach(([header, field]) => {
        const val = row[header]?.trim()
        if (!val) return
        if (field === 'deal_value') r[field] = parseFloat(val.replace(/[$,]/g, '')) || null
        else r[field] = val
      })
      r.created_by = session.user.email
      return r
    }).filter(r => r.name && r.phone) // require name + phone

    const valid = records.filter(r => r.name && r.phone)
    const skipped = records.length - valid.length

    let ok = 0, fail = 0
    // Insert in batches of 50
    for (let i = 0; i < valid.length; i += 50) {
      const batch = valid.slice(i, i + 50)
      const { error } = await supabase.from('clients').insert(batch)
      if (error) fail += batch.length
      else ok += batch.length
    }

    setImported(ok)
    setFailed(fail + skipped)
    setStep('done')
    if (ok > 0) onImported()
  }

  const mappedFields = Object.values(mapping)
  const hasName = mappedFields.includes('name')
  const hasPhone = mappedFields.includes('phone')
  const canImport = hasName && hasPhone && rows.length > 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title">Import Leads from CSV</div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {step === 'upload' && (
            <div>
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                Upload a CSV file with your leads. Required columns: <strong>name</strong> and <strong>phone</strong>.
                Optional: email, company, deal_value, assigned_to, notes, next_followup_date.
              </p>
              <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={downloadTemplate}>
                <Download size={14} /> Download Template CSV
              </button>
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 10,
                  padding: '40px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
              >
                <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <div style={{ fontWeight: 500 }}>Click to upload or drag &amp; drop</div>
                <div className="text-muted text-sm">.csv files only</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600 }}>{rows.length} rows found.</span>
                {!hasName && <span style={{ color: 'var(--danger)', fontSize: 13 }}>⚠ No "name" column detected</span>}
                {!hasPhone && <span style={{ color: 'var(--danger)', fontSize: 13 }}>⚠ No "phone" column detected</span>}
              </div>
              <div className="text-sm text-muted" style={{ marginBottom: 12 }}>
                Column mapping detected:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {Object.entries(mapping).map(([h, f]) => (
                  <span key={h} style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 12,
                    background: 'rgba(99,102,241,0.12)', color: '#818cf8'
                  }}>
                    {h} → {f}
                  </span>
                ))}
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      {Object.keys(mapping).map(h => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        {Object.keys(mapping).map(h => <td key={h}>{r[h] || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <div className="text-muted text-sm" style={{ marginTop: 6 }}>
                  …and {rows.length - 5} more rows
                </div>
              )}
              {!canImport && (
                <div style={{ marginTop: 12, color: 'var(--danger)', fontSize: 13 }}>
                  Cannot import: both "name" and "phone" columns are required.
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 500 }}>Importing {rows.length} leads…</div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle size={40} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{imported} leads imported!</div>
              {failed > 0 && (
                <div style={{ color: 'var(--warning)', fontSize: 13, marginTop: 4 }}>
                  {failed} rows skipped (missing name or phone, or duplicate)
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 'upload' && (
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          )}
          {step === 'preview' && (
            <>
              <button className="btn btn-ghost" onClick={() => setStep('upload')}>← Back</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={!canImport}>
                Import {rows.length} Leads
              </button>
            </>
          )}
          {step === 'done' && (
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  )
}

// Shared box dimensions for both last-note display and add-note textarea
const NOTE_BOX = { width: 220, height: 62, fontSize: 12, borderRadius: 6, padding: '6px 9px' }

function LastNoteCell({ client }) {
  const [lastNote, setLastNote] = useState(client.last_note_content || '')
  // keep in sync when parent re-fetches
  useEffect(() => setLastNote(client.last_note_content || ''), [client.last_note_content])

  return (
    <div
      title={lastNote || 'No notes yet'}
      style={{
        width: NOTE_BOX.width,
        height: NOTE_BOX.height,
        fontSize: NOTE_BOX.fontSize,
        borderRadius: NOTE_BOX.borderRadius,
        padding: NOTE_BOX.padding,
        boxSizing: 'border-box',
        background: 'var(--bg-subtle, rgba(0,0,0,0.04))',
        border: '1px solid var(--border)',
        color: lastNote ? 'var(--text)' : 'var(--text-muted)',
        fontStyle: lastNote ? 'normal' : 'italic',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        cursor: 'default',
        lineHeight: '1.4',
      }}
    >
      {lastNote || 'No notes yet'}
    </div>
  )
}

function AddNoteCell({ client, session, onNoteAdded }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!text.trim() || saving) return
    setSaving(true)
    const content = text.trim()
    const { error } = await supabase.from('notes').insert({
      client_id: client.id,
      content,
      created_by: session.user.email,
    })
    if (!error) {
      await supabase.from('clients')
        .update({ last_comment_date: new Date().toISOString(), last_note_content: content })
        .eq('id', client.id)
      onNoteAdded()
      setText('')
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
    setSaving(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type a note and press Ctrl+Enter to save…"
        style={{
          width: NOTE_BOX.width,
          height: NOTE_BOX.height,
          fontSize: NOTE_BOX.fontSize,
          borderRadius: NOTE_BOX.borderRadius,
          padding: NOTE_BOX.padding,
          boxSizing: 'border-box',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          color: 'var(--text)',
          outline: 'none',
          resize: 'none',
          lineHeight: '1.4',
          transition: 'border-color 0.15s',
          fontFamily: 'inherit',
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        onKeyDown={e => {
          if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.key === 'Enter' && !e.shiftKey && text.trim().indexOf('\n') === -1 && !e.shiftKey)) {
            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) return // allow newlines with plain Enter
            e.preventDefault()
            handleSave()
          }
        }}
      />
      {saved ? (
        <span style={{ position: 'absolute', bottom: 5, right: 7, color: 'var(--success)', fontSize: 14, pointerEvents: 'none' }}>✓</span>
      ) : text.trim() ? (
        <button
          className="btn btn-ghost btn-sm btn-icon"
          style={{ position: 'absolute', bottom: 4, right: 5, padding: '2px 4px' }}
          onClick={handleSave}
          disabled={saving}
          title="Save note (Ctrl+Enter)"
        >
          <Send size={12} />
        </button>
      ) : null}
    </div>
  )
}

function FollowUpCell({ client, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [note, setNote] = useState(client.followup_note || '')
  const now = dayjs()

  function defaultVal() { return now.format('YYYY-MM-DDTHH:mm') }

  useEffect(() => {
    setVal(client.next_followup_date ? dayjs(client.next_followup_date).format('YYYY-MM-DDTHH:mm') : defaultVal())
    setNote(client.followup_note || '')
  }, [client.next_followup_date, client.followup_note])

  function openEditor(e) {
    e.stopPropagation()
    if (!client.next_followup_date) setVal(defaultVal())
    setEditing(true)
  }

  async function save() {
    const { data, error } = await supabase
      .from('clients')
      .update({
        next_followup_date: val ? new Date(val).toISOString() : null,
        followup_note: note.trim() || null,
      })
      .eq('id', client.id)
      .select()
      .single()
    if (!error) onUpdate(data)
    setEditing(false)
  }

  if (editing) {
    return (
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 200 }}>
        <input
          type="datetime-local"
          autoFocus
          value={val}
          min={dayjs().format('YYYY-MM-DDTHH:mm')}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }}
          style={{ fontSize: 12, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
        />
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save() }}
          placeholder="Add a note for this follow-up… (optional)"
          rows={2}
          style={{ fontSize: 12, padding: '4px 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.4 }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={save}>Save</button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    )
  }

  const d = client.next_followup_date
  const isOverdue = d && dayjs(d).isBefore(now)
  const isToday = d && dayjs(d).format('YYYY-MM-DD') === now.format('YYYY-MM-DD')
  return (
    <div
      onClick={openEditor}
      title={d ? 'Click to edit follow-up' : 'Click to set follow-up'}
      style={{ cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', gap: 2, padding: '3px 8px', borderRadius: 6,
        border: `1px dashed ${d ? 'transparent' : 'var(--border)'}`,
        background: d ? 'transparent' : 'var(--bg-subtle, rgba(0,0,0,0.03))',
        transition: 'all 0.15s', maxWidth: 180 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-subtle, rgba(0,0,0,0.04))' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = d ? 'transparent' : 'var(--border)'; e.currentTarget.style.background = d ? 'transparent' : 'var(--bg-subtle, rgba(0,0,0,0.03))' }}
    >
      {d ? (
        <>
          <span style={{ fontSize: 12, fontWeight: isOverdue || isToday ? 600 : 400, color: isOverdue ? 'var(--danger)' : isToday ? 'var(--warning)' : 'inherit' }}>
            {dayjs(d).format('MMM D, HH:mm')}{isOverdue && ' ⚠'}
          </span>
          {client.followup_note && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}
              title={client.followup_note}>
              📝 {client.followup_note}
            </span>
          )}
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.7 }}>+ Set date & time</span>
      )}
    </div>
  )
}

export default function Clients({ session, isAdmin, companyId }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAssigned, setFilterAssigned] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [columns, setColumns] = useState(loadColumnPrefs)

  function handleColumnsChange(next) {
    setColumns(next)
    saveColumnPrefs(next)
  }

  const today = dayjs().format('YYYY-MM-DD')

  useEffect(() => {
    fetchClients()

    // Real-time updates
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchClients()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [filterStatus, filterAssigned, sortKey, sortDir, isAdmin])

  async function fetchClients() {
    let query = supabase.from('clients').select('*')
    // Non-admins only see leads assigned to them
    if (!isAdmin) query = query.eq('assigned_to', session.user.email)
    if (filterStatus) query = query.eq('status', filterStatus)
    if (filterAssigned) query = query.eq('assigned_to', filterAssigned)
    query = query.order(sortKey, { ascending: sortDir === 'asc', nullsFirst: false })
    const { data } = await query
    setClients(data || [])
    setLoading(false)
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return null
    return sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
  }

  const filtered = clients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q)
    )
  })

  const assignees = [...new Set(clients.map(c => c.assigned_to).filter(Boolean))]

  function rowClass(c) {
    if (!c.next_followup_date) return ''
    if (c.next_followup_date < today) return 'followup-overdue'
    if (c.next_followup_date === today) return 'followup-today'
    return ''
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Clients</div>
          <div className="page-subtitle">{clients.length} total · {filtered.length} shown</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ColumnOrganizer columns={columns} onChange={handleColumnsChange} />
          {isAdmin && (
            <button className="btn btn-ghost" onClick={() => setShowImport(true)}>
              <Upload size={15} /> Import CSV
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            <Plus size={16} /> Add Client
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="search-input"
            style={{ paddingLeft: 32 }}
            placeholder="Search name, phone, company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {isAdmin && assignees.length > 0 && (
          <select className="filter-select" value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)}>
            <option value="">All Reps</option>
            {assignees.map(a => <option key={a} value={a}>{a.split('@')[0]}</option>)}
          </select>
        )}
        {(search || filterStatus || filterAssigned) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterStatus(''); setFilterAssigned('') }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Phone size={36} />
              <p style={{ marginTop: 12 }}>No clients found</p>
              <button className="btn btn-primary btn-sm mt-4" onClick={() => setShowAddForm(true)}>
                <Plus size={14} /> Add your first client
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  {columns.filter(c => c.visible).map(col => (
                    <th key={col.key}
                      onClick={col.sortKey ? () => handleSort(col.sortKey) : undefined}
                      style={{ cursor: col.sortKey ? 'pointer' : 'default', width: col.key === 'call' ? 40 : undefined }}
                    >
                      {col.sortKey
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{col.label} <SortIcon k={col.sortKey} /></span>
                        : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className={rowClass(c)} onClick={() => setSelectedClient(c)}>
                    {columns.filter(col => col.visible).map(col => {
                      switch (col.key) {
                        case 'name':
                          return <td key="name" style={{ fontWeight: 600 }}>{c.name}</td>
                        case 'phone':
                          return (
                            <td key="phone" onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="text-muted" style={{ fontSize: 13 }}>{c.phone}</span>
                                <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener noreferrer"
                                  className="btn btn-ghost btn-sm btn-icon" title={`WhatsApp ${c.name}`}
                                  style={{ color: '#25D366', padding: '2px 4px', flexShrink: 0 }}>
                                  <WhatsAppIcon size={13} />
                                </a>
                              </div>
                            </td>
                          )
                        case 'call':
                          return (
                            <td key="call" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                              <a href={`zoomphoneapp://call?callee=${encodeURIComponent(c.phone)}`}
                                className="btn btn-ghost btn-sm btn-icon" title={`Call ${c.name}`}>
                                <Phone size={14} />
                              </a>
                            </td>
                          )
                        case 'last_note':
                          return <td key="last_note" onClick={e => e.stopPropagation()} style={{ verticalAlign: 'middle' }}><LastNoteCell client={c} /></td>
                        case 'add_note':
                          return <td key="add_note" onClick={e => e.stopPropagation()} style={{ verticalAlign: 'middle' }}><AddNoteCell client={c} session={session} onNoteAdded={fetchClients} /></td>
                        case 'company_name':
                          return <td key="company_name" className="text-muted">{c.company_name || '—'}</td>
                        case 'status':
                          return <td key="status"><StatusBadge status={c.status} /></td>
                        case 'client_time':
                          return <td key="client_time"><LocalTimeBadge phone={c.phone} /></td>
                        case 'deal_value':
                          return (
                            <td key="deal_value">
                              {c.deal_value ? <span className="deal-value positive">${Number(c.deal_value).toLocaleString()}</span> : <span className="text-muted">—</span>}
                            </td>
                          )
                        case 'next_followup_date':
                          return (
                            <td key="next_followup_date" onClick={e => e.stopPropagation()}>
                              <FollowUpCell client={c} onUpdate={updated => setClients(prev => prev.map(x => x.id === updated.id ? updated : x))} />
                            </td>
                          )
                        case 'assigned_to':
                          return <td key="assigned_to" className="text-sm text-muted">{c.assigned_to ? c.assigned_to.split('@')[0] : '—'}</td>
                        default:
                          return <td key={col.key} />
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAddForm && (
        <AddClientForm
          session={session}
          companyId={companyId}
          onClose={() => setShowAddForm(false)}
          onAdded={c => setClients(prev => [c, ...prev])}
        />
      )}

      {showImport && (
        <ImportModal
          session={session}
          companyId={companyId}
          onClose={() => setShowImport(false)}
          onImported={fetchClients}
        />
      )}

      {selectedClient && (
        <ClientModal
          client={selectedClient}
          session={session}
          isAdmin={isAdmin}
          onClose={() => setSelectedClient(null)}
          onUpdate={updated => {
            setClients(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSelectedClient(updated)
          }}
          onDelete={id => {
            setClients(prev => prev.filter(c => c.id !== id))
            setSelectedClient(null)
          }}
        />
      )}
    </div>
  )
}
