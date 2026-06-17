import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import dayjs from 'dayjs'
import { TrendingUp, Users, PhoneCall, CalendarCheck } from 'lucide-react'

const STATUS_LABELS = {
  new: 'New',
  no_answer: 'No Answer',
  follow_up: 'Follow Up',
  in_the_money: 'In The Money',
  not_interested: 'Not Interested',
  monkey: 'Monkey',
  broke: 'Broke',
}

export default function Dashboard({ session }) {
  const [stats, setStats] = useState({
    total: 0, followUp: 0, inTheMoney: 0, totalRevenue: 0,
    statusBreakdown: {},
  })
  const [todayFollowups, setTodayFollowups] = useState([])
  const [overdueFollowups, setOverdueFollowups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const todayStart = dayjs().startOf('day').toISOString()
    const todayEnd = dayjs().endOf('day').toISOString()

    const [clientsRes, followupsRes, overdueRes] = await Promise.all([
      supabase.from('clients').select('status, deal_value'),
      supabase.from('clients')
        .select('id, name, phone, status, company_name, next_followup_date, followup_note')
        .gte('next_followup_date', todayStart)
        .lte('next_followup_date', todayEnd)
        .order('next_followup_date'),
      supabase.from('clients')
        .select('id, name, phone, status, company_name, next_followup_date, followup_note')
        .lt('next_followup_date', todayStart)
        .not('next_followup_date', 'is', null)
        .order('next_followup_date'),
    ])

    const clients = clientsRes.data || []
    const breakdown = {}
    let revenue = 0
    for (const c of clients) {
      breakdown[c.status] = (breakdown[c.status] || 0) + 1
      if (c.deal_value) revenue += parseFloat(c.deal_value)
    }

    setStats({
      total: clients.length,
      followUp: breakdown.follow_up || 0,
      inTheMoney: breakdown.in_the_money || 0,
      totalRevenue: revenue,
      statusBreakdown: breakdown,
    })
    setTodayFollowups(followupsRes.data || [])
    setOverdueFollowups(overdueRes.data || [])
    setLoading(false)
  }

  if (loading) return <div className="spinner" style={{ margin: '60px auto' }} />

  const pipelineOrder = ['new', 'no_answer', 'follow_up', 'in_the_money', 'not_interested', 'monkey', 'broke']

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">
            Welcome back, {session.user.email} — {dayjs().format('dddd, MMMM D YYYY')}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Clients</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Follow Ups</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.followUp}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In The Money</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.inTheMoney}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            ${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Pipeline Breakdown */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} /> Pipeline Breakdown
          </div>
          {pipelineOrder.map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <StatusBadge status={s} />
              <span style={{ fontWeight: 700 }}>{stats.statusBreakdown[s] || 0}</span>
            </div>
          ))}
        </div>

        {/* Today's Follow-ups */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarCheck size={18} /> Today's Follow-ups
            {todayFollowups.length > 0 && (
              <span style={{ background: 'var(--warning)', color: '#fff', borderRadius: '20px', padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>
                {todayFollowups.length}
              </span>
            )}
          </div>
          {overdueFollowups.length > 0 && (
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠ {overdueFollowups.length} overdue</span>
              {' '}follow-ups need attention.{' '}
              <Link to="/clients" style={{ color: 'var(--danger)', fontWeight: 600 }}>View all →</Link>
            </div>
          )}
          {todayFollowups.length === 0 ? (
            <div className="empty-state">
              <p>No follow-ups scheduled for today 🎉</p>
            </div>
          ) : (
            <div className="followup-list">
              {todayFollowups.map(c => (
                <div key={c.id} className="followup-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div className="followup-name">{c.name}</div>
                      <div className="followup-phone" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{c.phone}{c.company_name && ` · ${c.company_name}`}</span>
                        {c.next_followup_date && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                            🕐 {dayjs(c.next_followup_date).format('HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                    <a
                      href={`zoomphoneapp://call?number=${encodeURIComponent(c.phone)}`}
                      className="btn btn-primary btn-sm"
                      onClick={e => e.stopPropagation()}
                      title="Call with Zoom Phone"
                    >
                      Call
                    </a>
                  </div>
                  {c.followup_note && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-subtle, rgba(0,0,0,0.04))', borderRadius: 6, padding: '4px 10px', borderLeft: '3px solid var(--accent)', lineHeight: 1.4 }}>
                      📝 {c.followup_note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
