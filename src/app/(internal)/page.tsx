'use client'

import { useAuth } from '@/lib/auth/AuthContext'

export default function DashboardPage() {
  const { user } = useAuth()

  const displayName = user ? `${user.name} ${user.surname}`.trim() || user.email : 'User'

  return (
    <div>
      <h1 style={styles.welcome}>Welcome, {displayName}</h1>
      <p style={styles.subtitle}>
        {user?.role ?? 'No role assigned'} &middot; {user?.email}
      </p>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Leads</h2>
          <p style={styles.cardValue}>—</p>
          <p style={styles.cardLabel}>Total leads tracked</p>
        </div>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Tenants</h2>
          <p style={styles.cardValue}>—</p>
          <p style={styles.cardLabel}>Active organizations</p>
        </div>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Recent activity</h2>
          <p style={styles.cardValue}>—</p>
          <p style={styles.cardLabel}>Audit events (7 days)</p>
        </div>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Pending actions</h2>
          <p style={styles.cardValue}>—</p>
          <p style={styles.cardLabel}>Items requiring attention</p>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  welcome: {
    fontSize: 24,
    fontWeight: 600,
    margin: '0 0 4px',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    margin: '0 0 24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '0 0 8px',
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a1a',
    margin: '0 0 4px',
  },
  cardLabel: {
    fontSize: 12,
    color: '#999',
    margin: 0,
  },
}
