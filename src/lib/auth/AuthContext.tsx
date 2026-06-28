'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { SessionClient, type MeResponse } from './session-client'

export interface AuthState {
  user: MeResponse | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

interface AuthProviderProps {
  children: React.ReactNode
  sessionClient?: SessionClient
}

export function AuthProvider({ children, sessionClient }: AuthProviderProps) {
  const client = useRef(sessionClient ?? new SessionClient())
  const [user, setUser] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const data = await client.current.me()
        if (!cancelled) {
          setUser(data)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const sessionErr = err as { status?: number; message?: string }
          if (sessionErr.status === 401) {
            setUser(null)
          } else if (sessionErr.status === 403) {
            setError('Account inactive. Please contact an administrator.')
            setUser(null)
          } else {
            setError(sessionErr.message || 'Failed to load session. Please try again.')
            setUser(null)
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const signOut = useCallback(async () => {
    setUser(null)
    setError(null)

    try {
      await client.current.logout()
    } catch {
      // Optimistically clear local state even if the request fails
    }

    window.location.href = '/auth/login'
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
