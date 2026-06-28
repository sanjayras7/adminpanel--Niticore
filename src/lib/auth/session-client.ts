export interface MeResponse {
  id: string
  name: string
  surname: string
  email: string
  role: string | null
  last_login_at: string | null
  totp_enabled: boolean
}

export interface SessionClientError {
  status: number
  message: string
  code?: string
}

export class SessionClient {
  private baseUrl: string

  constructor(baseUrl = '/api/v1/internal') {
    this.baseUrl = baseUrl
  }

  async me(): Promise<MeResponse> {
    const res = await fetch(`${this.baseUrl}/me`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      let message = 'Failed to fetch session'
      let code: string | undefined
      try {
        const body = await res.json()
        message = body.message || message
        code = body.error
      } catch {}
      throw { status: res.status, message, code } as SessionClientError
    }

    return res.json()
  }

  async logout(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      let message = 'Failed to sign out'
      try {
        const body = await res.json()
        message = body.message || message
      } catch {}
      throw { status: res.status, message } as SessionClientError
    }
  }
}
