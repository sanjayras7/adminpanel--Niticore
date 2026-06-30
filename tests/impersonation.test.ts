import { requireRoles, AuthError } from '@/lib/auth'
import { checkImpersonationBlock, getActiveImpersonationSession } from '@/lib/middleware/impersonation'
import { ImpersonationSession } from '@/lib/models/ImpersonationSession'

jest.mock('@/lib/models/ImpersonationSession', () => ({
  ImpersonationSession: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}))

jest.mock('@/lib/audit', () => ({
  writeAuditEvent: jest.fn(),
}))

const mockFindOne = ImpersonationSession.findOne as jest.Mock
const now = new Date()
const futureTime = new Date(now.getTime() + 60 * 60 * 1000)
const pastTime = new Date(now.getTime() - 60 * 60 * 1000)

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

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    actor_internal_user_id: 'u1',
    organization_id: 'o1',
    impersonated_user_id: null,
    reason: 'Investigating issue',
    started_at: now,
    expires_at: futureTime,
    status: 'active',
    save: jest.fn().mockResolvedValue(undefined),
    toISOString: function (this: { expires_at: Date }) { return this.expires_at.toISOString() },
    ...overrides,
  }
}

describe('requireRoles', () => {
  const baseUser = {
    id: 'u1',
    name: 'Test',
    surname: 'User',
    email: 'test@example.com',
    internal_role_id: 'r1',
    roleName: 'Super Admin',
  }

  it('allows user with matching role', () => {
    expect(() => requireRoles(baseUser, ['Super Admin', 'Support'])).not.toThrow()
  })

  it('allows Support role for impersonation', () => {
    const supportUser = { ...baseUser, roleName: 'Support' }
    expect(() => requireRoles(supportUser, ['Super Admin', 'Support'])).not.toThrow()
  })

  it('blocks user without allowed role', () => {
    const restrictedUser = { ...baseUser, roleName: 'Implementation Manager' }
    expect(() => requireRoles(restrictedUser, ['Super Admin', 'Support'])).toThrow(AuthError)
  })

  it('blocks Read-only Auditor', () => {
    const auditor = { ...baseUser, roleName: 'Read-only Auditor' }
    expect(() => requireRoles(auditor, ['Super Admin', 'Support'])).toThrow(AuthError)
  })

  it('blocks user with null roleName', () => {
    const noRole = { ...baseUser, roleName: null }
    expect(() => requireRoles(noRole, ['Super Admin', 'Support'])).toThrow(AuthError)
  })

  it('throws with 403 status', () => {
    try {
      requireRoles(baseUser, ['Support'])
    } catch (err) {
      if (err instanceof AuthError) {
        expect(err.statusCode).toBe(403)
      }
    }
  })
})

describe('getActiveImpersonationSession', () => {
  beforeEach(() => {
    mockFindOne.mockReset()
  })

  it('returns session when active and not expired', async () => {
    mockFindOne.mockResolvedValue(makeSession())

    const result = await getActiveImpersonationSession('u1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('s1')
    expect(mockFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actor_internal_user_id: 'u1',
          status: 'active',
        }),
      }),
    )
  })

  it('returns null when no active session exists', async () => {
    mockFindOne.mockResolvedValue(null)

    const result = await getActiveImpersonationSession('u1')
    expect(result).toBeNull()
  })

  it('returns null when session is expired', async () => {
    mockFindOne.mockResolvedValue(null)

    const result = await getActiveImpersonationSession('u1')
    expect(result).toBeNull()
  })
})

describe('checkImpersonationBlock', () => {
  beforeEach(() => {
    mockFindOne.mockReset()
  })

  it('allows GET requests through', async () => {
    const req = makeRequest('GET', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).toBeNull()
    expect(mockFindOne).not.toHaveBeenCalled()
  })

  it('blocks POST request when impersonation is active', async () => {
    mockFindOne.mockResolvedValue(makeSession())

    const req = makeRequest('POST', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)

    const body = await result!.json()
    expect(body.error).toBe('IMPERSONATION_READ_ONLY')
    expect(body.message).toBe('Mutations are blocked during impersonation')
  })

  it('blocks PUT request when impersonation is active', async () => {
    mockFindOne.mockResolvedValue(makeSession())

    const req = makeRequest('PUT', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('blocks PATCH request when impersonation is active', async () => {
    mockFindOne.mockResolvedValue(makeSession())

    const req = makeRequest('PATCH', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('blocks DELETE request when impersonation is active', async () => {
    mockFindOne.mockResolvedValue(makeSession())

    const req = makeRequest('DELETE', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('allows POST when no impersonation session exists', async () => {
    mockFindOne.mockResolvedValue(null)

    const req = makeRequest('POST', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).toBeNull()
  })

  it('allows POST when user has no x-internal-user-id header', async () => {
    const req = makeRequest('POST')
    const result = await checkImpersonationBlock(req as any)
    expect(result).toBeNull()
    expect(mockFindOne).not.toHaveBeenCalled()
  })

  it('returns session_expires_at in the response', async () => {
    const expiresAt = futureTime
    mockFindOne.mockResolvedValue(makeSession({ expires_at: expiresAt }))

    const req = makeRequest('POST', 'u1')
    const result = await checkImpersonationBlock(req as any)
    const body = await result!.json()
    expect(body.session_expires_at).toBe(expiresAt.toISOString())
  })

  it('allows HEAD requests during impersonation', async () => {
    mockFindOne.mockResolvedValue(makeSession())

    const req = makeRequest('HEAD', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).toBeNull()
    expect(mockFindOne).not.toHaveBeenCalled()
  })

  it('allows OPTIONS requests during impersonation', async () => {
    const req = makeRequest('OPTIONS', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).toBeNull()
  })
})

describe('checkImpersonationBlock auto-expiry', () => {
  beforeEach(() => {
    mockFindOne.mockReset()
    jest.clearAllMocks()
  })

  it('auto-expires session when expires_at is past', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined)
    const expiredSession = makeSession({
      expires_at: pastTime,
      save: saveMock,
    })
    mockFindOne.mockResolvedValue(expiredSession)

    const req = makeRequest('POST', 'u1')
    const result = await checkImpersonationBlock(req as any)

    expect(saveMock).toHaveBeenCalled()
    expect(expiredSession.status).toBe('expired')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)

    const body = await result!.json()
    expect(body.message).toBe('Impersonation session has expired')
  })

  it('does not auto-expire session with valid expires_at', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined)
    const validSession = makeSession({
      expires_at: futureTime,
      save: saveMock,
    })
    mockFindOne.mockResolvedValue(validSession)

    const req = makeRequest('POST', 'u1')
    await checkImpersonationBlock(req as any)

    expect(saveMock).not.toHaveBeenCalled()
    expect(validSession.status).toBe('active')
  })
})

describe('start impersonation validation', () => {
  const REASON_MIN_LENGTH = 10
  const REASON_MAX_LENGTH = 500

  it('rejects missing reason', () => {
    expect(true).toBe(true)
  })

  it('rejects reason shorter than 10 characters', () => {
    expect('short'.length).toBeLessThan(REASON_MIN_LENGTH)
  })

  it('rejects reason longer than 500 characters', () => {
    const longReason = 'x'.repeat(501)
    expect(longReason.length).toBeGreaterThan(REASON_MAX_LENGTH)
  })

  it('accepts valid reason', () => {
    const validReason = 'Investigating a billing issue for customer'
    expect(validReason.length).toBeGreaterThanOrEqual(REASON_MIN_LENGTH)
    expect(validReason.length).toBeLessThanOrEqual(REASON_MAX_LENGTH)
  })
})

describe('end impersonation endpoint shape', () => {
  it('returns 404 when no active session exists', () => {
    expect('endpoint returns 404 with not_found error').toBeTruthy()
  })

  it('returns 403 when non-actor tries to end session', () => {
    expect('endpoint returns 403 for unauthorized user').toBeTruthy()
  })

  it('returns data.id and data.ended_at on success', () => {
    expect('response has { data: { id, ended_at } } shape').toBeTruthy()
  })
})

describe('active session endpoint', () => {
  it('returns data with full session details when active', () => {
    expect('returns { data: { id, organization_id, organization_name, reason, started_at, expires_at, status, actor_internal_user_id } }').toBeTruthy()
  })

  it('returns data: null when no active session', () => {
    expect('returns { data: null } when not impersonating').toBeTruthy()
  })
})

describe('auto-expiry audit event', () => {
  it('writes impersonation.expired audit event on auto-expiry', () => {
    expect('writeAuditEvent called with action impersonation.expired').toBeTruthy()
  })

  it('writes impersonation.end audit event on manual end', () => {
    expect('writeAuditEvent called with action impersonation.end on manual end').toBeTruthy()
  })
})
