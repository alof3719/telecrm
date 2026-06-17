import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'

const STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'in_the_money', label: '💰 In The Money' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'monkey', label: '🐒 Monkey' },
  { value: 'broke', label: 'Broke' },
]

const EMPTY = {
  name: '', phone: '', email: '', company_name: '',
  status: 'new', deal_value: '', assigned_to: '', next_followup_date: '',
}

export default function AddClientForm({ onClose, onAdded, session, companyId }) {
  const [form, setForm] = useState({ ...EMPTY, assigned_to: session.user.email })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and Phone are required.')
      return
    }
    setSaving(true)
    setError(null)
    const { data, error } = await supabase.from('clients').insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      company_name: form.company_name.trim() || null,
      status: form.status,
      deal_value: form.deal_value ? parseFloat(form.deal_value) : null,
      assigned_to: form.assigned_to.trim() || null,
      next_followup_date: form.next_followup_date || null,
      company_id: companyId,
    }).select().single()

    if (error) { setError(error.message); setSaving(false); return }
    onAdded(data)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title">Add New Client</div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ background: '#fef2f2', color: '#ef4444', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                {error}
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith" />
              </div>
              <div className="form-group">
                <label>Phone * (include country code)</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+61 412 345 678" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
              </div>
              <div className="form-group">
                <label>Company</label>
                <input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Acme Corp" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Deal Value ($)</label>
                <input type="number" min="0" step="0.01" value={form.deal_value} onChange={e => set('deal_value', e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Assigned To</label>
                <input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="form-group">
                <label>Next Follow-up Date</label>
                <input type="date" value={form.next_followup_date} onChange={e => set('next_followup_date', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
