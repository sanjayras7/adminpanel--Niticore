'use client'

import { useState, type FormEvent } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/v1/internal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message || 'Something went wrong. Please try again.')
        return
      }

      setSent(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Check your email</h1>
          <p style={styles.text}>
            If an account exists for <strong>{email}</strong>, a magic link has been sent.
          </p>
          <p style={styles.text}>
            Click the link in the email to sign in, or use the one-time code provided.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Niticore Admin</h1>
        <p style={styles.text}>Enter your email to receive a magic link.</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="email" style={styles.label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@niticore.com"
            style={styles.input}
            disabled={submitting}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Sending...' : 'Send magic link'}
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
    maxWidth: 400,
    padding: 32,
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    margin: '0 0 8px',
  },
  text: {
    fontSize: 14,
    color: '#555',
    margin: '0 0 20px',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
  },
  input: {
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 6,
    border: '1px solid #ccc',
    outline: 'none',
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
}
