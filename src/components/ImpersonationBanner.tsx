'use client'

import { useState, useEffect, useCallback } from 'react'

interface SessionCheckResponse {
  active: boolean
  expires_at?: string
  organization_id?: string
  impersonated_user_id?: string
}

export function ImpersonationBanner() {
  const [session, setSession] = useState<SessionCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [ending, setEnding] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      try {
        const res = await fetch('/api/v1/internal/impersonation/session-check')
        if (!res.ok) {
          if (!cancelled) setLoading(false)
          return
        }
        const data: SessionCheckResponse = await res.json()
        if (!cancelled) {
          setSession(data)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    checkSession()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!session?.active) return
    const started = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [session?.active])

  const handleEndImpersonation = useCallback(async () => {
    setEnding(true)
    try {
      const res = await fetch('/api/v1/internal/impersonation/end', { method: 'POST' })
      if (res.ok) {
        setSession(null)
      }
    } catch {
      // fail silently per design doc — server-side mutation block is the real gate
    } finally {
      setEnding(false)
    }
  }, [])

  if (loading) return null
  if (!session?.active) return null

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const elapsedDisplay = mins > 0
    ? `${mins}m ${secs}s`
    : `${secs}s`

  return (
    <div
      data-testid="impersonation-banner"
      style={styles.container}
      role="alert"
    >
      <div style={styles.inner}>
        <span style={styles.icon} aria-hidden="true">!</span>
        <span style={styles.text}>
          <strong>Impersonating</strong>
          <span style={styles.separator}>—</span>
          Read Only
          <span style={styles.elapsed}>({elapsedDisplay})</span>
        </span>
        <button
          onClick={handleEndImpersonation}
          disabled={ending}
          style={ending ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
          data-testid="end-impersonation-button"
        >
          {ending ? 'Ending\u2026' : 'End Impersonation'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'sticky',
    top: 0,
    zIndex: 9999,
    background: '#FFF3CD',
    borderBottom: '1px solid #FFE69C',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    lineHeight: 1.5,
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '8px 16px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#856404',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  text: {
    color: '#856404',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  separator: {
    margin: '0 2px',
  },
  elapsed: {
    opacity: 0.7,
    fontSize: 12,
  },
  button: {
    marginLeft: 12,
    padding: '4px 12px',
    fontSize: 13,
    fontWeight: 500,
    border: '1px solid #856404',
    borderRadius: 4,
    background: '#fff',
    color: '#856404',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
}
