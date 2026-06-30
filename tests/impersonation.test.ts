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
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/models', () => ({
  InternalUser: {
    findByPk: jest.fn(),
  },
  InternalRole: {},
}))

import { logAuditEvent } from '@/lib/audit'

const mockFindOne = ImpersonationSession.findOne as jest.Mock
const now = new Date()
const futureTime = new Date(now.getTime() + 60 * 60 * 1000)
const pastTime = new Date(now.getTime() - 60 * 60 * 1000)

function makeRequest(
  method: string,
  userId?: string,
): Request {
  const headers: Record<string, string> = {}
  if (userId) headers['x-internal-user-id'] = userId

  return new Request('http://localhost/api/test', { method, headers })
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
    jest.clearAllMocks()
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

  it('writes impersonation.expired audit event on auto-expiry', async () => {
    const saveMock = jest.fn().mockResolvedValue(undefined)
    const expiredSession = makeSession({
      expires_at: pastTime,
      save: saveMock,
    })
    mockFindOne.mockResolvedValue(expiredSession)

    const req = makeRequest('POST', 'u1')
    await checkImpersonationBlock(req as any)

    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'impersonation.expired',
        targetId: 's1',
        actorInternalUserId: 'u1',
      }),
    )
  })

  it('does not write audit event for valid non-expired session', async () => {
    mockFindOne.mockResolvedValue(makeSession())

    const req = makeRequest('POST', 'u1')
    await checkImpersonationBlock(req as any)

    expect(logAuditEvent).not.toHaveBeenCalled()
  })
})
