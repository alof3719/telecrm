import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import { LayoutDashboard, Users, LogOut, Phone } from 'lucide-react'

function Layout({ session, onLogout }) {
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
          <Route path="/clients" element={<Clients session={session} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
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
        <Layout session={session} onLogout={handleLogout} />
      ) : (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
