const mockGetAuthUser = jest.fn()
const mockRequireRoles = jest.fn()
const mockSequelizeQuery = jest.fn()
const mockWriteAuditEvent = jest.fn()
const mockImpersonationCreate = jest.fn()

jest.mock('@/lib/auth', () => {
  class MockAuthError extends Error {
    statusCode: number
    constructor(message: string, statusCode: number = 401) {
      super(message)
      this.name = 'AuthError'
      this.statusCode = statusCode
    }
  }
  return {
    getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
    requireRoles: (...args: unknown[]) => mockRequireRoles(...args),
    AuthError: MockAuthError,
  }
})

jest.mock('@/lib/sequelize', () => ({
  sequelize: { query: (...args: unknown[]) => mockSequelizeQuery(...args) },
}))

jest.mock('@/lib/audit', () => ({
  writeAuditEvent: (...args: unknown[]) => mockWriteAuditEvent(...args),
}))

jest.mock('@/lib/models/ImpersonationSession', () => ({
  ImpersonationSession: { create: (...args: unknown[]) => mockImpersonationCreate(...args) },
}))

function makeRequest(
  method: string,
  userId?: string,
  body?: unknown,
): Request {
  const headers: Record<string, string> = {}
  if (userId) headers['x-internal-user-id'] = userId
  if (body) headers['content-type'] = 'application/json'

  const init: RequestInit = { method, headers }
  if (body) init.body = JSON.stringify(body)

  return new Request('http://localhost/api/test', init)
}

describe('POST /api/v1/internal/impersonation/start', () => {
  beforeEach(() => {
    mockGetAuthUser.mockReset()
    mockRequireRoles.mockReset()
    mockSequelizeQuery.mockReset()
    mockWriteAuditEvent.mockReset()
    mockImpersonationCreate.mockReset()
  })

  it('rejects unauthorized role with 403 IMPERSONATION_NOT_AUTHORIZED', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', roleName: 'Implementation Manager' })
    mockRequireRoles.mockImplementation(() => {
      const { AuthError } = require('@/lib/auth')
      throw new AuthError('Required role: Super Admin or Support', 403)
    })

    const { POST } = await import('@/app/api/v1/internal/impersonation/start/route')
    const req = makeRequest('POST', 'u1', { organization_id: 'o1', reason: 'Investigating a billing issue' })
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error).toBe('IMPERSONATION_NOT_AUTHORIZED')
  })

  it('rejects missing reason with 400', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', roleName: 'Super Admin' })
    mockRequireRoles.mockReturnValue(undefined)

    const { POST } = await import('@/app/api/v1/internal/impersonation/start/route')
    const req = makeRequest('POST', 'u1', { organization_id: 'o1' })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects empty reason with 400', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', roleName: 'Super Admin' })
    mockRequireRoles.mockReturnValue(undefined)

    const { POST } = await import('@/app/api/v1/internal/impersonation/start/route')
    const req = makeRequest('POST', 'u1', { organization_id: 'o1', reason: '' })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects short reason with 400', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', roleName: 'Super Admin' })
    mockRequireRoles.mockReturnValue(undefined)

    const { POST } = await import('@/app/api/v1/internal/impersonation/start/route')
    const req = makeRequest('POST', 'u1', { organization_id: 'o1', reason: 'short' })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects missing organization_id with 400', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', roleName: 'Super Admin' })
    mockRequireRoles.mockReturnValue(undefined)

    const { POST } = await import('@/app/api/v1/internal/impersonation/start/route')
    const req = makeRequest('POST', 'u1', { reason: 'Investigating a billing issue' })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects non-existent organization with 404', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', roleName: 'Super Admin' })
    mockRequireRoles.mockReturnValue(undefined)
    mockSequelizeQuery.mockResolvedValue([[]])

    const { POST } = await import('@/app/api/v1/internal/impersonation/start/route')
    const req = makeRequest('POST', 'u1', { organization_id: 'nonexistent-org', reason: 'Investigating a billing issue' })
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBe('ORGANIZATION_NOT_FOUND')
  })

  it('rejects user not in org with 404', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', roleName: 'Super Admin' })
    mockRequireRoles.mockReturnValue(undefined)
    mockSequelizeQuery
      .mockResolvedValueOnce([[{ id: 'o1' }]])
      .mockResolvedValueOnce([[]])

    const { POST } = await import('@/app/api/v1/internal/impersonation/start/route')
    const req = makeRequest('POST', 'u1', { organization_id: 'o1', impersonated_user_id: 'not-in-org', reason: 'Investigating a billing issue' })
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBe('USER_NOT_FOUND_IN_ORG')
  })

  it('succeeds with valid data for authorized user', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', roleName: 'Super Admin' })
    mockRequireRoles.mockReturnValue(undefined)
    mockSequelizeQuery.mockResolvedValue([[{ id: 'o1' }]])
    mockImpersonationCreate.mockResolvedValue({
      id: 'session-1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      impersonated_user_id: null,
      reason: 'Investigating a billing issue',
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      status: 'active',
    })

    const { POST } = await import('@/app/api/v1/internal/impersonation/start/route')
    const req = makeRequest('POST', 'u1', { organization_id: 'o1', reason: 'Investigating a billing issue' })
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.session_id).toBe('session-1')
    expect(body.status).toBe('active')
  })

  it('writes audit event on successful start', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', name: 'Test', roleName: 'Super Admin' })
    mockRequireRoles.mockReturnValue(undefined)
    mockSequelizeQuery.mockResolvedValue([[{ id: 'o1' }]])
    mockImpersonationCreate.mockResolvedValue({
      id: 'session-1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      impersonated_user_id: null,
      reason: 'Investigating a billing issue',
      expires_at: new Date(Date.now() + 30 * 60 * 1000),
      status: 'active',
    })

    const { POST } = await import('@/app/api/v1/internal/impersonation/start/route')
    const req = makeRequest('POST', 'u1', { organization_id: 'o1', reason: 'Investigating a billing issue' })
    await POST(req as any)
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'impersonation.start',
        actor_internal_user_id: 'u1',
      }),
    )
  })
})

const mockValidateAndClear = jest.fn()
const mockGetActiveSession = jest.fn()

jest.mock('@/lib/middleware/impersonation', () => ({
  getActiveImpersonationSession: (...args: unknown[]) => mockGetActiveSession(...args),
  validateAndClearImpersonationSession: (...args: unknown[]) => mockValidateAndClear(...args),
}))

describe('POST /api/v1/internal/impersonation/end', () => {
  beforeEach(() => {
    mockGetAuthUser.mockReset()
    mockGetActiveSession.mockReset()
    mockValidateAndClear.mockReset()
    mockWriteAuditEvent.mockReset()
  })

  it('rejects unauthenticated request with 401', async () => {
    mockGetAuthUser.mockRejectedValue(Object.assign(new Error('Authentication required'), { statusCode: 401, name: 'AuthError' }))

    const { POST } = await import('@/app/api/v1/internal/impersonation/end/route')
    const req = makeRequest('POST')
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it('rejects with 400 when no active session exists', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', roleName: 'Super Admin' })
    mockValidateAndClear.mockResolvedValue(undefined)
    mockGetActiveSession.mockResolvedValue(null)

    const { POST } = await import('@/app/api/v1/internal/impersonation/end/route')
    const req = makeRequest('POST', 'u1')
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe('NO_ACTIVE_IMPERSONATION')
  })

  it('succeeds with 200 when active session exists', async () => {
    const mockSession = {
      id: 'session-1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      status: 'active',
      ended_at: null,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      save: jest.fn().mockResolvedValue(true),
    }

    mockGetAuthUser.mockResolvedValue({ id: 'u1', roleName: 'Super Admin' })
    mockValidateAndClear.mockResolvedValue(undefined)
    mockGetActiveSession.mockResolvedValue(mockSession)

    const { POST } = await import('@/app/api/v1/internal/impersonation/end/route')
    const req = makeRequest('POST', 'u1')
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('ended')
    expect(body.ended_at).toBeDefined()
  })

  it('writes audit event on successful end', async () => {
    const mockSession = {
      id: 'session-1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      status: 'active',
      ended_at: null,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
      save: jest.fn().mockResolvedValue(true),
    }

    mockGetAuthUser.mockResolvedValue({ id: 'u1', roleName: 'Super Admin' })
    mockValidateAndClear.mockResolvedValue(undefined)
    mockGetActiveSession.mockResolvedValue(mockSession)

    const { POST } = await import('@/app/api/v1/internal/impersonation/end/route')
    const req = makeRequest('POST', 'u1')
    await POST(req as any)
    expect(mockWriteAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'impersonation.end',
        actor_internal_user_id: 'u1',
      }),
    )
  })
})
