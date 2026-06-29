'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface AuthUser {
  id: string
  name: string
  surname: string
  email: string
  roleName: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  isLoaded: boolean
  isAuditor: boolean
  canMutate: boolean
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoaded: false,
  isAuditor: false,
  canMutate: false,
  setUser: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('auth_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        sessionStorage.removeItem('auth_user')
      }
    }
    setIsLoaded(true)
  }, [])

  const handleSetUser = (u: AuthUser | null) => {
    setUser(u)
    if (u) {
      sessionStorage.setItem('auth_user', JSON.stringify(u))
    } else {
      sessionStorage.removeItem('auth_user')
    }
  }

  const isAuditor = user?.roleName === 'Read-only Auditor'
  const canMutate = !isAuditor

  return (
    <AuthContext.Provider value={{ user, isLoaded, isAuditor, canMutate, setUser: handleSetUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
