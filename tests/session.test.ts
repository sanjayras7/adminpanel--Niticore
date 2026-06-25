import crypto from 'crypto'
import { NextRequest } from 'next/server'

const mockDestroy = jest.fn().mockResolvedValue(undefined)

function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: '7b3e4c12-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    internal_user_id: '123e4567-e89b-12d3-a456-426614174000',
    token_hash: crypto.createHash('sha256').update('valid-token-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxx').digest('hex'),
    expires_at: new Date(Date.now() + 86400000),
    idle_expires_at: new Date(Date.now() + 3600000),
    created_at: new Date(),
    last_activity_at: new Date(),
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
    destroy: mockDestroy,
    ...overrides,
  }
}

const mockInternalSession = {
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
}

jest.mock('@/lib/models/InternalSession', () => ({
  InternalSession: mockInternalSession,
}))

jest.mock('@/lib/sequelize', () => ({
  sequelize: {
    query: jest.fn(),
  },
}))

jest.mock('@/lib/models', () => ({
  InternalUser: {
    findByPk: jest.fn(),
  },
  InternalSession: mockInternalSession,
}))

jest.mock('@/lib/jwt', () => ({
  signTempToken: jest.fn(),
  verifyTempToken: jest.fn(),
}))

jest.mock('@/lib/email', () => ({
  sendMagicLinkEmail: jest.fn(),
}))

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  checkEmailRateLimit: jest.fn().mockReturnValue(true),
  resetRateLimiter: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockDestroy.mockClear()
})

function makeRequest(cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers['cookie'] = cookie
  return new NextRequest('http://localhost/api/v1/internal/test', { headers })
}

describe('createInternalSession()', () => {
  it('creates a session row with hashed token (no plaintext in DB)', async () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000'
    mockInternalSession.create.mockResolvedValue(createMockSession())

    const { createInternalSession } = await import('@/lib/create-internal-session')
    const result = await createInternalSession(userId, '10.0.0.1', 'test-agent')

    expect(mockInternalSession.create).toHaveBeenCalledTimes(1)
    const callArg = mockInternalSession.create.mock.calls[0][0]

    expect(callArg.internal_user_id).toBe(userId)
    expect(callArg.token_hash).toBeDefined()
    expect(callArg.token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(typeof result.token).toBe('string')
    expect(result.token).toMatch(/^[0-9a-f]{64}$/)
    expect(result.token).not.toBe(callArg.token_hash)
  })

  it('returns sessionId, token, expiresAt, idleExpiresAt', async () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000'
    const now = new Date()
    mockInternalSession.create.mockResolvedValue(createMockSession({
      created_at: now,
      expires_at: new Date(now.getTime() + 1440 * 60000),
      idle_expires_at: new Date(now.getTime() + 60 * 60000),
    }))

    const { createInternalSession } = await import('@/lib/create-internal-session')
    const result = await createInternalSession(userId, '10.0.0.1', 'test-agent')

    expect(result).toHaveProperty('sessionId')
    expect(result).toHaveProperty('token')
    expect(result).toHaveProperty('expiresAt')
    expect(result).toHaveProperty('idleExpiresAt')
    expect(typeof result.sessionId).toBe('string')
    expect(typeof result.token).toBe('string')
    expect(typeof result.expiresAt).toBe('string')
    expect(typeof result.idleExpiresAt).toBe('string')
  })

  it('uses default absolute expiry (24h) and idle expiry (1h) from config', async () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000'
    const { config } = await import('@/config')
    mockInternalSession.create.mockResolvedValue(createMockSession())

    const { createInternalSession } = await import('@/lib/create-internal-session')
    await createInternalSession(userId, '10.0.0.1', 'test-agent')

    const callArg = mockInternalSession.create.mock.calls[0][0]
    const expiresAt = new Date(callArg.expires_at).getTime()
    const idleExpiresAt = new Date(callArg.idle_expires_at).getTime()
    const created = new Date(callArg.created_at).getTime()

    expect(expiresAt - created).toBeCloseTo(config.session.absoluteExpiryMinutes * 60000, -4)
    expect(idleExpiresAt - created).toBeCloseTo(config.session.idleExpiryMinutes * 60000, -4)
  })

  it('accepts custom expiry options', async () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000'
    mockInternalSession.create.mockResolvedValue(createMockSession())

    const { createInternalSession } = await import('@/lib/create-internal-session')
    await createInternalSession(userId, '10.0.0.1', 'test-agent', {
      absoluteExpiryMinutes: 60,
      idleExpiryMinutes: 10,
    })

    const callArg = mockInternalSession.create.mock.calls[0][0]
    const expiresAt = new Date(callArg.expires_at).getTime()
    const idleExpiresAt = new Date(callArg.idle_expires_at).getTime()
    const created = new Date(callArg.created_at).getTime()

    expect(expiresAt - created).toBeCloseTo(60 * 60000, -3)
    expect(idleExpiresAt - created).toBeCloseTo(10 * 60000, -3)
  })

  it('stores ip_address and user_agent', async () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000'
    mockInternalSession.create.mockResolvedValue(createMockSession())

    const { createInternalSession } = await import('@/lib/create-internal-session')
    await createInternalSession(userId, '192.168.1.1', 'Mozilla/5.0 Test')

    const callArg = mockInternalSession.create.mock.calls[0][0]
    expect(callArg.ip_address).toBe('192.168.1.1')
    expect(callArg.user_agent).toBe('Mozilla/5.0 Test')
  })
})

describe('getInternalSession()', () => {
  it('returns auth data for a valid session', async () => {
    const mockSession = createMockSession()
    mockInternalSession.findOne.mockResolvedValue(mockSession)
    mockInternalSession.update.mockResolvedValue([1])

    const { getInternalSession } = await import('@/lib/internal-auth')
    const result = await getInternalSession(makeRequest('internal_session=' + 'a'.repeat(64)))

    expect(result).not.toBeNull()
    expect(result!.internalUserId).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(result!.sessionId).toBe('7b3e4c12-1a2b-3c4d-5e6f-7a8b9c0d1e2f')
  })

  it('returns null when no cookie is present', async () => {
    const { getInternalSession } = await import('@/lib/internal-auth')
    const result = await getInternalSession(makeRequest())

    expect(result).toBeNull()
    expect(mockInternalSession.findOne).not.toHaveBeenCalled()
  })

  it('returns null when cookie value is not valid hex', async () => {
    const { getInternalSession } = await import('@/lib/internal-auth')
    const result = await getInternalSession(makeRequest('internal_session=not-valid-hex!!!'))

    expect(result).toBeNull()
    expect(mockInternalSession.findOne).not.toHaveBeenCalled()
  })

  it('returns null when session is not found by hash', async () => {
    mockInternalSession.findOne.mockResolvedValue(null)

    const { getInternalSession } = await import('@/lib/internal-auth')
    const result = await getInternalSession(makeRequest('internal_session=' + 'a'.repeat(64)))

    expect(result).toBeNull()
  })

  it('returns null when session has absolute expired', async () => {
    const expiredSession = createMockSession({
      expires_at: new Date(Date.now() - 1000),
    })
    mockInternalSession.findOne.mockResolvedValue(expiredSession)

    const { getInternalSession } = await import('@/lib/internal-auth')
    const result = await getInternalSession(makeRequest('internal_session=' + 'a'.repeat(64)))

    expect(result).toBeNull()
    expect(expiredSession.destroy).toHaveBeenCalled()
  })

  it('returns null when session has idle expired', async () => {
    const idleExpiredSession = createMockSession({
      idle_expires_at: new Date(Date.now() - 1000),
    })
    mockInternalSession.findOne.mockResolvedValue(idleExpiredSession)

    const { getInternalSession } = await import('@/lib/internal-auth')
    const result = await getInternalSession(makeRequest('internal_session=' + 'a'.repeat(64)))

    expect(result).toBeNull()
    expect(idleExpiredSession.destroy).toHaveBeenCalled()
  })

  it('updates last_activity_at on valid request', async () => {
    const mockSession = createMockSession()
    mockInternalSession.findOne.mockResolvedValue(mockSession)
    mockInternalSession.update.mockResolvedValue([1])

    const { getInternalSession } = await import('@/lib/internal-auth')
    await getInternalSession(makeRequest('internal_session=' + 'a'.repeat(64)))

    expect(mockInternalSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_activity_at: expect.any(Date) }),
      expect.objectContaining({
        where: { id: mockSession.id },
        fields: ['last_activity_at'],
      }),
    )
  })

  it('returns null for a customer-shaped credential (same path as any unknown token)', async () => {
    mockInternalSession.findOne.mockResolvedValue(null)

    const { getInternalSession } = await import('@/lib/internal-auth')
    const result = await getInternalSession(makeRequest('internal_session=' + 'b'.repeat(64)))

    expect(result).toBeNull()
    expect(mockInternalSession.findOne).toHaveBeenCalled()
  })

  it('never consults customer auth tables', async () => {
    const { sequelize } = await import('@/lib/sequelize')
    mockInternalSession.findOne.mockResolvedValue(createMockSession())
    mockInternalSession.update.mockResolvedValue([1])

    const { getInternalSession } = await import('@/lib/internal-auth')
    await getInternalSession(makeRequest('internal_session=' + 'a'.repeat(64)))

    expect(mockInternalSession.findOne).toHaveBeenCalled()
    expect(sequelize.query).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/internal/logout', () => {
  it('destroys the session and clears cookie', async () => {
    const mockSession = createMockSession()
    mockInternalSession.findOne.mockResolvedValue(mockSession)
    mockInternalSession.update.mockResolvedValue([1])
    mockInternalSession.destroy.mockResolvedValue(0)

    const { POST } = await import('@/app/api/v1/internal/logout/route')
    const response = await POST(makeRequest('internal_session=' + 'a'.repeat(64)))

    expect(response.status).toBe(204)
    expect(mockInternalSession.destroy).toHaveBeenCalledWith({
      where: { id: mockSession.id },
    })

    const setCookie = response.headers.get('set-cookie') || ''
    expect(setCookie).toContain('internal_session=')
    expect(setCookie).toContain('Max-Age=0')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=lax')
  })

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/v1/internal/logout/route')
    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('unauthorized')
  })
})

describe('GET /api/v1/internal/me', () => {
  it('returns user profile for authenticated request', async () => {
    const mockSession = createMockSession()
    mockInternalSession.findOne.mockResolvedValue(mockSession)
    mockInternalSession.update.mockResolvedValue([1])

    const { sequelize } = await import('@/lib/sequelize')
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'John',
      surname: 'Doe',
      email: 'john@niticore.com',
      role: 'Super Admin',
      last_login_at: '2026-06-25T10:00:00Z',
      totp_enabled: true,
    }
    ;(sequelize.query as jest.Mock).mockResolvedValue([mockUser])

    const { GET } = await import('@/app/api/v1/internal/me/route')
    const response = await GET(makeRequest('internal_session=' + 'a'.repeat(64)))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.name).toBe('John')
    expect(body.surname).toBe('Doe')
    expect(body.email).toBe('john@niticore.com')
    expect(body.role).toBe('Super Admin')
    expect(body.totp_enabled).toBe(true)
  })

  it('returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/v1/internal/me/route')
    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('unauthorized')
  })
})

describe('POST /api/v1/internal/auth/create-session (bridge until TOTP)', () => {
  it('creates a session and sets cookie for valid temp JWT', async () => {
    const { verifyTempToken } = await import('@/lib/jwt')
    const { InternalUser } = await import('@/lib/models')
    ;(verifyTempToken as jest.Mock).mockReturnValue({
      sub: '123e4567-e89b-12d3-a456-426614174000',
      purpose: 'totp',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    })
    ;(InternalUser.findByPk as jest.Mock).mockResolvedValue({
      id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'active',
    })

    const mockSession = createMockSession()
    mockInternalSession.create.mockResolvedValue(mockSession)

    const { POST } = await import('@/app/api/v1/internal/auth/create-session/route')
    const request = new NextRequest('http://localhost/api/v1/internal/auth/create-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1', 'user-agent': 'test' },
      body: JSON.stringify({ temp_token: 'valid-jwt-token' }),
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.id).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(body.session_id).toBeDefined()

    const setCookie = response.headers.get('set-cookie') || ''
    expect(setCookie).toContain('internal_session=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=lax')
  })

  it('rejects missing temp_token in body', async () => {
    const { POST } = await import('@/app/api/v1/internal/auth/create-session/route')
    const request = new NextRequest('http://localhost/api/v1/internal/auth/create-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('invalid_request')
  })

  it('rejects invalid or expired temp JWT', async () => {
    const { verifyTempToken } = await import('@/lib/jwt')
    ;(verifyTempToken as jest.Mock).mockImplementation(() => {
      throw new Error('jwt expired')
    })

    const { POST } = await import('@/app/api/v1/internal/auth/create-session/route')
    const request = new NextRequest('http://localhost/api/v1/internal/auth/create-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ temp_token: 'expired-jwt' }),
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('invalid_token')
  })

  it('rejects temp JWT for inactive user', async () => {
    const { verifyTempToken } = await import('@/lib/jwt')
    const { InternalUser } = await import('@/lib/models')
    ;(verifyTempToken as jest.Mock).mockReturnValue({
      sub: '123e4567-e89b-12d3-a456-426614174000',
    })
    ;(InternalUser.findByPk as jest.Mock).mockResolvedValue({
      id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'locked',
    })

    const { POST } = await import('@/app/api/v1/internal/auth/create-session/route')
    const request = new NextRequest('http://localhost/api/v1/internal/auth/create-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ temp_token: 'valid-jwt' }),
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('unauthorized')
  })
})
