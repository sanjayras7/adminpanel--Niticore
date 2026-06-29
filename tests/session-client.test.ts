import { SessionClient, type MeResponse } from '@/lib/auth/session-client'

const mockFetch = jest.fn()
global.fetch = mockFetch

const mockUser: MeResponse = {
  id: 'user-1',
  name: 'Jane',
  surname: 'Doe',
  email: 'jane@niticore.com',
  role: 'Super Admin',
  last_login_at: '2026-06-28T00:00:00Z',
  totp_enabled: true,
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('SessionClient.me()', () => {
  it('returns user data on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockUser,
    })

    const client = new SessionClient()
    const result = await client.me()

    expect(result).toEqual(mockUser)
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/internal/me', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('throws with status 401 when unauthenticated', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized', message: 'No valid session' }),
    })

    const client = new SessionClient()
    await expect(client.me()).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized',
    })
  })

  it('throws with status 403 for inactive user', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden', message: 'Account inactive' }),
    })

    const client = new SessionClient()
    await expect(client.me()).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
      message: 'Account inactive',
    })
  })

  it('throws on 500 server error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server_error', message: 'Internal server error' }),
    })

    const client = new SessionClient()
    await expect(client.me()).rejects.toMatchObject({
      status: 500,
      message: 'Internal server error',
    })
  })

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const client = new SessionClient()
    await expect(client.me()).rejects.toThrow(TypeError)
  })

  it('uses custom base URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockUser,
    })

    const client = new SessionClient('https://admin.example.com/api')
    await client.me()

    expect(mockFetch).toHaveBeenCalledWith('https://admin.example.com/api/me', expect.any(Object))
  })
})

describe('SessionClient.logout()', () => {
  it('sends POST and resolves on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    })

    const client = new SessionClient()
    await expect(client.logout()).resolves.toBeUndefined()

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/internal/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Logout failed' }),
    })

    const client = new SessionClient()
    await expect(client.logout()).rejects.toMatchObject({
      status: 500,
      message: 'Logout failed',
    })
  })

  it('uses generic message on non-JSON error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json') },
    })

    const client = new SessionClient()
    await expect(client.logout()).rejects.toMatchObject({
      status: 500,
      message: 'Failed to sign out',
    })
  })
})
