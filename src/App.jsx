import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import UsersPage from './pages/Users'
import { LayoutDashboard, Users, LogOut, Phone, Shield } from 'lucide-react'

function Layout({ session, isAdmin, companyId, fullName, onLogout }) {
  const displayName = fullName || session.user.email.split('@')[0]
  const avatar = (fullName || session.user.email)[0].toUpperCase()

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Phone size={22} />
          <span>TeleCRM</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          <NavLink to="/clients" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <Users size={18} />
            Clients
          </NavLink>
          {isAdmin && (
            <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Shield size={18} />
              Users
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{avatar}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div className="user-email" style={{ fontSize: 11 }}>{session.user.email}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard session={session} />} />
          <Route path="/clients" element={<Clients session={session} isAdmin={isAdmin} companyId={companyId} />} />
          {isAdmin && (
            <Route path="/users" element={<UsersPage session={session} />} />
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [companyId, setCompanyId] = useState(null)
  const [fullName, setFullName] = useState('')

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role, company_id, full_name')
      .eq('id', userId)
      .single()
    setIsAdmin(data?.role === 'admin')
    setCompanyId(data?.company_id || null)
    setFullName(data?.full_name || '')
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else { setIsAdmin(false); setCompanyId(null); setFullName('') }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      {session ? (
        <Layout session={session} isAdmin={isAdmin} companyId={companyId} fullName={fullName} onLogout={handleLogout} />
      ) : (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
