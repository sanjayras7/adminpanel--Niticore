'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

export default function EnrollTotpPage() {
  const router = useRouter()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [manualKey, setManualKey] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)

  const getTempToken = useCallback(() => {
    const token = sessionStorage.getItem('totp_temp_token')
    if (!token) {
      router.replace('/auth/login')
    }
    return token
  }, [router])

  useEffect(() => {
    const token = getTempToken()
    if (!token) return

    async function fetchQr() {
      try {
        const res = await fetch('/api/v1/internal/auth/enroll-totp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.message || 'Failed to load enrollment details.')
          return
        }

        const data = await res.json()
        setQrCode(data.qr_code)
        setManualKey(data.manual_key)
      } catch {
        setError('Network error. Please check your connection.')
      } finally {
        setLoading(false)
      }
    }

    fetchQr()
  }, [getTempToken])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const token = getTempToken()
    if (!token) return

    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/v1/internal/auth/enroll-totp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmation_code: code }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Enrollment failed. Please try again.')
        return
      }

      setEnrolled(true)

      const sessionRes = await fetch('/api/v1/internal/auth/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_token: token }),
      })

      if (sessionRes.ok) {
        sessionStorage.removeItem('totp_temp_token')
        window.location.href = '/'
      } else {
        router.replace('/auth/login')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!sessionStorage.getItem('totp_temp_token')) {
    return null
  }

  if (enrolled) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Enrollment successful</h1>
          <p style={styles.text}>Signing in...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Setting up...</h1>
          <p style={styles.text}>Please wait while we prepare your authenticator app setup.</p>
        </div>
      </div>
    )
  }

  if (error && !qrCode) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Setup failed</h1>
          <p style={styles.text}>{error}</p>
          <a href="/auth/login" style={styles.link}>Back to login</a>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Set up two-factor authentication</h1>
        <p style={styles.text}>
          Open your authenticator app and scan the code below, or enter the key manually.
        </p>
        {qrCode && (
          <div style={styles.qrContainer}>
            <img src={qrCode} alt="TOTP QR code" style={styles.qrImage} />
          </div>
        )}
        {manualKey && (
          <p style={styles.manualKey}>
            Manual key: <strong>{manualKey}</strong>
          </p>
        )}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="code" style={styles.label}>Verification code</label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            style={styles.input}
            disabled={submitting}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Verifying...' : 'Verify and sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 32,
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: '0 0 8px',
  },
  text: {
    fontSize: 14,
    color: '#555',
    margin: '0 0 20px',
    lineHeight: 1.5,
    textAlign: 'left' as const,
  },
  qrContainer: {
    margin: '0 auto 16px',
    textAlign: 'center' as const,
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  manualKey: {
    fontSize: 12,
    color: '#666',
    wordBreak: 'break-all' as const,
    margin: '0 0 16px',
    textAlign: 'center' as const,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left' as const,
  },
  input: {
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 6,
    border: '1px solid #ccc',
    outline: 'none',
    textAlign: 'center' as const,
    letterSpacing: 4,
  },
  button: {
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 6,
    border: 'none',
    background: '#0052CC',
    color: '#fff',
    cursor: 'pointer',
  },
  error: {
    fontSize: 13,
    color: '#D93025',
    margin: 0,
  },
  link: {
    fontSize: 14,
    color: '#0052CC',
    textDecoration: 'underline',
  },
}
