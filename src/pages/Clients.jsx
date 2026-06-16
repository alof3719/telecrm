import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import ClientModal from '../components/ClientModal'
import AddClientForm from '../components/AddClientForm'
import { getClientLocalTime, getTimezoneLabel } from '../lib/timezones'
import dayjs from 'dayjs'
import { Plus, Search, Phone, Clock, ChevronUp, ChevronDown } from 'lucide-react'

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

export default function Clients({ session }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAssigned, setFilterAssigned] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
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
  }, [filterStatus, filterAssigned, sortKey, sortDir])

  async function fetchClients() {
    let query = supabase.from('clients').select('*')
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

  // Collect unique assigned-to values for filter
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
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
          <Plus size={16} /> Add Client
        </button>
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
        {assignees.length > 1 && (
          <select className="filter-select" value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)}>
            <option value="">All Reps</option>
            {assignees.map(a => <option key={a} value={a}>{a}</option>)}
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
                  <th>Company</th>
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
                  <th>Assigned</th>
                  <th onClick={() => handleSort('last_call_date')} style={{ cursor: 'pointer' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Last Call <SortIcon k="last_call_date" /></span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className={rowClass(c)} onClick={() => setSelectedClient(c)}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="text-muted">{c.phone}</td>
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
                    <td>
                      {c.last_call_date ? dayjs(c.last_call_date).format('MMM D') : <span className="text-muted">—</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <a
                        href={`zoomphoneapp://call?number=${encodeURIComponent(c.phone)}`}
                        className="btn btn-ghost btn-sm btn-icon"
                        title={`Call ${c.name}`}
                      >
                        <Phone size={14} />
                      </a>
                    </td>
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
          onClose={() => setShowAddForm(false)}
          onAdded={c => setClients(prev => [c, ...prev])}
        />
      )}

      {selectedClient && (
        <ClientModal
          client={selectedClient}
          session={session}
          onClose={() => setSelectedClient(null)}
          onUpdate={updated => {
            setClients(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSelectedClient(updated)
          }}
        />
      )}
    </div>
  )
}
