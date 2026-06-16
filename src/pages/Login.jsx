import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Phone } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <Phone size={26} />
          TeleCRM
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Sign in</h2>
        <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
          Enter your credentials to access the CRM
        </p>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ justifyContent: 'center', marginTop: 8 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-muted text-sm" style={{ marginTop: 20, textAlign: 'center' }}>
          Contact your admin to create an account.
        </p>
      </div>
    </div>
  )
}
