'use client'

import { useAuth, AuthProvider } from '@/lib/auth/AuthContext'
import { SessionClient, type NavItem } from '@/lib/auth/session-client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

const sessionClient = new SessionClient()

function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, error, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [navItems, setNavItems] = useState<NavItem[] | null>(null)
  const [navError, setNavError] = useState(false)

  useEffect(() => {
    if (!loading && !user && !error) {
      router.replace('/auth/login')
    }
  }, [loading, user, error, router])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function loadNav() {
      try {
        const data = await sessionClient.nav()
        if (!cancelled) setNavItems(data.items)
      } catch {
        if (!cancelled) setNavError(true)
      }
    }

    loadNav()

    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.errorCard}>
          <p style={styles.errorText}>{error}</p>
          <button onClick={() => window.location.reload()} style={styles.retryButton}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const displayName = `${user.name} ${user.surname}`.trim() || user.email

  async function handleSignOut() {
    setMenuOpen(false)
    await signOut()
  }

  return (
    <div style={styles.layout}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>Niticore</span>
          <span style={styles.badge}>Internal — Super Admin Panel</span>
        </div>
        <div style={styles.headerRight}>
          <div ref={menuRef} style={styles.userMenuWrapper}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={styles.userButton}
              aria-label="User menu"
            >
              <div style={styles.avatar}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span style={styles.userName}>{displayName}</span>
              <span style={styles.chevron}>{menuOpen ? '\u25B2' : '\u25BC'}</span>
            </button>
            {menuOpen && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownHeader}>
                  <div style={styles.dropdownName}>{displayName}</div>
                  <div style={styles.dropdownRole}>{user.role ?? 'No role assigned'}</div>
                  <div style={styles.dropdownEmail}>{user.email}</div>
                </div>
                <hr style={styles.divider} />
                <button onClick={handleSignOut} style={styles.signOutButton}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div style={styles.body}>
        <nav style={styles.sidebar}>
          <div style={styles.sidebarTitle}>Navigation</div>
          {navError || (!navItems && !loading)
            ? <div style={styles.sidebarItem}>Dashboard</div>
            : navItems === null
              ? <>
                  <div style={styles.sidebarSkeleton} />
                  <div style={styles.sidebarSkeleton} />
                  <div style={styles.sidebarSkeleton} />
                </>
              : navItems.length === 0
                ? <div style={styles.sidebarEmpty}>No modules available</div>
                : navItems.map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== '/internal' && pathname.startsWith(item.href))
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        style={isActive ? styles.sidebarItemActive : styles.sidebarItem}
                      >
                        {item.label}
                      </a>
                    )
                  })
          }
        </nav>
        <main style={styles.main}>{children}</main>
      </div>
    </div>
  )
}

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    padding: '0 24px',
    borderBottom: '1px solid #e0e0e0',
    background: '#fff',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1a1a1a',
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 4,
    background: '#E8F5E9',
    color: '#2E7D32',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
  },
  userMenuWrapper: {
    position: 'relative',
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#0052CC',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 600,
  },
  userName: {
    fontWeight: 500,
    color: '#333',
  },
  chevron: {
    fontSize: 10,
    color: '#888',
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: 4,
    width: 260,
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 100,
  },
  dropdownHeader: {
    padding: 16,
  },
  dropdownName: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  dropdownRole: {
    fontSize: 13,
    color: '#555',
    marginTop: 2,
  },
  dropdownEmail: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #e0e0e0',
    margin: 0,
  },
  signOutButton: {
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: '#D93025',
    textAlign: 'left',
  },
  body: {
    display: 'flex',
    flex: 1,
  },
  sidebar: {
    width: 220,
    borderRight: '1px solid #e0e0e0',
    padding: '16px 0',
    flexShrink: 0,
    background: '#fafafa',
  },
  sidebarTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: '#888',
    padding: '8px 16px',
  },
  sidebarItem: {
    fontSize: 14,
    padding: '8px 16px',
    color: '#333',
    fontWeight: 400,
    textDecoration: 'none',
    display: 'block',
    cursor: 'pointer',
  },
  sidebarItemActive: {
    fontSize: 14,
    padding: '8px 16px',
    color: '#0052CC',
    fontWeight: 500,
    background: '#E8F0FE',
    borderRight: '2px solid #0052CC',
    textDecoration: 'none',
    display: 'block',
    cursor: 'pointer',
  },
  sidebarSkeleton: {
    height: 14,
    margin: '8px 16px',
    borderRadius: 4,
    background: '#e0e0e0',
  },
  sidebarEmpty: {
    fontSize: 13,
    padding: '8px 16px',
    color: '#888',
  },
  main: {
    flex: 1,
    padding: 24,
    background: '#f5f5f5',
    overflowY: 'auto',
  },
  loadingContainer: {
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e0e0e0',
    borderTop: '3px solid #0052CC',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorCard: {
    textAlign: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#D93025',
    marginBottom: 16,
  },
  retryButton: {
    padding: '8px 16px',
    fontSize: 14,
    borderRadius: 6,
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
  },
}
