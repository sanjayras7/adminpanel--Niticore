'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense } from 'react'

function EnrollContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tempToken = searchParams.get('temp_token')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tempToken) return

    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/v1/internal/auth/enroll-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_token: tempToken, totp_code: code }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message || 'Enrollment failed. Please try again.')
        return
      }

      window.location.href = '/'
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!tempToken) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p>Invalid session. Please <a href="/auth/login" style={styles.link}>log in again</a>.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Set up two-factor authentication</h1>
        <p style={styles.text}>
          Open your authenticator app and scan the code displayed on your device, then enter the
          verification code below.
        </p>
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

export default function EnrollTotpPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.container}>
          <div style={styles.card}><p>Loading...</p></div>
        </div>
      }
    >
      <EnrollContent />
    </Suspense>
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
    maxWidth: 400,
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
    textAlign: 'left',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left',
  },
  input: {
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 6,
    border: '1px solid #ccc',
    outline: 'none',
    textAlign: 'center',
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
