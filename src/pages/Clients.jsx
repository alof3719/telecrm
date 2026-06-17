import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import ClientModal from '../components/ClientModal'
import AddClientForm from '../components/AddClientForm'
import { getClientLocalTime, getTimezoneLabel } from '../lib/timezones'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { Plus, Search, Phone, Clock, ChevronUp, ChevronDown, Upload, Download, X, CheckCircle, Send } from 'lucide-react'

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

function QuickNoteInline({ client, session, onNoteAdded }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lastNote, setLastNote] = useState(client.last_note_content || '')

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
      setLastNote(content)
      onNoteAdded()
      setText('')
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }} onClick={e => e.stopPropagation()}>
      {/* Last note display */}
      <div style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        background: 'var(--bg-subtle, rgba(0,0,0,0.04))',
        borderRadius: 4,
        padding: '3px 7px',
        minHeight: 22,
        maxWidth: 160,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontStyle: lastNote ? 'normal' : 'italic',
      }} title={lastNote || ''}>
        {lastNote || 'No notes yet'}
      </div>
      {/* New note input */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add note… ↵"
          style={{
            fontSize: 11,
            padding: '3px 7px',
            width: 120,
            borderRadius: 5,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        {saved ? (
          <span style={{ color: 'var(--success)', fontSize: 13 }}>✓</span>
        ) : text.trim() ? (
          <button className="btn btn-ghost btn-sm btn-icon" style={{ padding: '2px 4px' }} onClick={handleSave} disabled={saving}>
            <Send size={11} />
          </button>
        ) : null}
      </div>
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
        <div style={{ display: 'flex', gap: 8 }}>
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
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Name <SortIcon k="name" /></span>
                  </th>
                  <th>Phone</th>
                  <th style={{ width: 40 }}></th>
                  <th onClick={() => handleSort('last_call_date')} style={{ cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Last Call / Note <SortIcon k="last_call_date" /></span>
                  </th>
                  <th onClick={() => handleSort('company_name')} style={{ cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Company <SortIcon k="company_name" /></span>
                  </th>
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Status <SortIcon k="status" /></span>
                  </th>
                  <th>Client Time</th>
                  <th onClick={() => handleSort('deal_value')} style={{ cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Deal <SortIcon k="deal_value" /></span>
                  </th>
                  <th onClick={() => handleSort('next_followup_date')} style={{ cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Follow-up <SortIcon k="next_followup_date" /></span>
                  </th>
                  <th onClick={() => handleSort('assigned_to')} style={{ cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Assigned <SortIcon k="assigned_to" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className={rowClass(c)} onClick={() => setSelectedClient(c)}>
                    {/* 1 - Name */}
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    {/* 2 - Phone + WhatsApp */}
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="text-muted" style={{ fontSize: 13 }}>{c.phone}</span>
                        <a
                          href={whatsappUrl(c.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm btn-icon"
                          title={`WhatsApp ${c.name}`}
                          style={{ color: '#25D366', padding: '2px 4px', flexShrink: 0 }}
                        >
                          <WhatsAppIcon size={13} />
                        </a>
                      </div>
                    </td>
                    {/* 3 - Call button */}
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <a
                        href={`zoomphoneapp://call?number=${encodeURIComponent(c.phone)}`}
                        className="btn btn-ghost btn-sm btn-icon"
                        title={`Call ${c.name}`}
                      >
                        <Phone size={14} />
                      </a>
                    </td>
                    {/* 4 - Last Call + inline note */}
                    <td onClick={e => e.stopPropagation()}>
                      <QuickNoteInline
                        client={c}
                        session={session}
                        onNoteAdded={fetchClients}
                      />
                    </td>
                    {/* 5+ - rest */}
                    <td className="text-muted">{c.company_name || '—'}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td><LocalTimeBadge phone={c.phone} /></td>
                    <td>
                      {c.deal_value
                        ? <span className="deal-value positive">${Number(c.deal_value).toLocaleString()}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {c.next_followup_date ? (
                        <span style={{ color: c.next_followup_date < today ? 'var(--danger)' : c.next_followup_date === today ? 'var(--warning)' : 'inherit', fontWeight: c.next_followup_date <= today ? 600 : 400 }}>
                          {dayjs(c.next_followup_date).format('MMM D')}
                          {c.next_followup_date < today && ' ⚠'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-sm text-muted">{c.assigned_to ? c.assigned_to.split('@')[0] : '—'}</td>
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
