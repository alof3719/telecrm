import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import UsersPage from './pages/Users'
import { LayoutDashboard, Users, LogOut, Phone, Shield, TrendingUp, Settings } from 'lucide-react'
import Trading from './pages/Trading'
import TradingAdmin from './pages/TradingAdmin'

function Layout({ session, isAdmin, companyId, onLogout }) {
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
          <NavLink to="/trading" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <TrendingUp size={18} />
            Trading
          </NavLink>
          {isAdmin && (
            <NavLink to="/trading/admin" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Settings size={18} />
              Trading Admin
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{session.user.email[0].toUpperCase()}</div>
            <span className="user-email">{session.user.email}</span>
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
          <Route path="/trading" element={<Trading session={session} companyId={companyId} />} />
          {isAdmin && (
            <Route path="/trading/admin" element={<TradingAdmin session={session} companyId={companyId} />} />
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

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', userId)
      .single()
    setIsAdmin(data?.role === 'admin')
    setCompanyId(data?.company_id || null)
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
      else { setIsAdmin(false); setCompanyId(null) }
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
        <Layout session={session} isAdmin={isAdmin} companyId={companyId} onLogout={handleLogout} />
      ) : (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
