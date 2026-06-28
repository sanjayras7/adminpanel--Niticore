'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying')

  useEffect(() => {
    const token = searchParams.get('token')
    const otp = searchParams.get('otp')

    if (!token && !otp) {
      setError('Missing verification code.')
      setStatus('error')
      return
    }

    async function verify() {
      try {
        const body: Record<string, string> = {}
        if (token) body.token = token
        if (otp) body.otp = otp

        const res = await fetch('/api/v1/internal/auth/verify-magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.message || 'Verification failed.')
          setStatus('error')
          return
        }

        if (data.totp_enrollment_required) {
          router.replace(`/auth/enroll-totp?temp_token=${data.temp_token}`)
        } else if (data.totp_required) {
          const url = `/auth/verify-totp?temp_token=${encodeURIComponent(data.temp_token)}`
          router.replace(url)
        }
      } catch {
        setError('Network error. Please try again.')
        setStatus('error')
      }
    }

    verify()
  }, [searchParams, router])

  if (status === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Verification failed</h1>
          <p style={styles.text}>{error}</p>
          <a href="/auth/login" style={styles.link}>Back to login</a>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Verifying...</h1>
        <p style={styles.text}>Please wait while we verify your link.</p>
      </div>
    </div>
  )
}

export default function VerifyMagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.title}>Verifying...</h1>
            <p style={styles.text}>Please wait while we verify your link.</p>
          </div>
        </div>
      }
    >
      <VerifyContent />
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
  link: {
    fontSize: 14,
    color: '#0052CC',
    textDecoration: 'underline',
  },
}
