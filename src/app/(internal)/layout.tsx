'use client'

import { AuthProvider, useAuth } from '@/lib/frontend/auth-context'
import Link from 'next/link'
import type { ReactNode } from 'react'

function Shell({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useAuth()

  if (!isLoaded) {
    return <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>Loading...</div>
  }

  if (!user) {
    return <LoginGate />
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f5f5f5' }}>
      <nav style={{ background: '#1a1a2e', color: '#fff', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link href="/frameworks" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 18 }}>
          Niticore Admin
        </Link>
        <Link href="/frameworks" style={{ color: '#ccc', textDecoration: 'none', fontSize: 14 }}>
          Frameworks
        </Link>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#aaa' }}>
          {user.name} {user.surname} ({user.roleName})
        </span>
        <button
          onClick={() => {
            sessionStorage.removeItem('auth_user')
            window.location.reload()
          }}
          style={{ background: 'transparent', color: '#ccc', border: '1px solid #555', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          Sign out
        </button>
      </nav>
      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}

function LoginGate() {
  const { setUser } = useAuth()

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const id = fd.get('userId') as string
    const name = fd.get('name') as string
    const surname = fd.get('surname') as string
    const email = fd.get('email') as string
    const roleName = fd.get('roleName') as string
    if (id && name) {
      setUser({ id, name, surname, email, roleName })
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Niticore Admin</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Sign in (dev mode — select a role)
      </p>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>User ID</label>
          <input name="userId" defaultValue="user-dev-1" required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Name</label>
          <input name="name" defaultValue="Dev" required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Surname</label>
          <input name="surname" defaultValue="User" style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
          <input name="email" defaultValue="dev@example.com" style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Role</label>
          <select name="roleName" defaultValue="Super Admin" style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
            <option value="Super Admin">Super Admin</option>
            <option value="Read-only Auditor">Read-only Auditor</option>
          </select>
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, cursor: 'pointer' }}>
          Sign in
        </button>
      </form>
    </div>
  )
}

export default function InternalLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  )
}
