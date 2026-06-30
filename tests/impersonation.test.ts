import { requireRoles, AuthError } from '@/lib/auth'
import { checkImpersonationBlock, getActiveImpersonationSession } from '@/lib/middleware/impersonation'
import { ImpersonationSession } from '@/lib/models/ImpersonationSession'
import { validateReason } from '@/app/api/v1/internal/impersonation/start/route'

jest.mock('@/lib/models/ImpersonationSession', () => ({
  ImpersonationSession: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}))

const mockFindOne = ImpersonationSession.findOne as jest.Mock
const now = new Date()
const futureTime = new Date(now.getTime() + 60 * 60 * 1000)

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
    mockFindOne.mockResolvedValue({
      id: 's1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      impersonated_user_id: null,
      reason: 'Investigating issue',
      started_at: now,
      expires_at: futureTime,
      status: 'active',
    })

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
    mockFindOne.mockResolvedValue({
      id: 's1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      reason: 'Testing',
      expires_at: futureTime,
      status: 'active',
    })

    const req = makeRequest('POST', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)

    const body = await result!.json()
    expect(body.error).toBe('IMPERSONATION_READ_ONLY')
  })

  it('blocks PUT request when impersonation is active', async () => {
    mockFindOne.mockResolvedValue({
      id: 's1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      reason: 'Testing',
      expires_at: futureTime,
      status: 'active',
    })

    const req = makeRequest('PUT', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('blocks PATCH request when impersonation is active', async () => {
    mockFindOne.mockResolvedValue({
      id: 's1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      reason: 'Testing',
      expires_at: futureTime,
      status: 'active',
    })

    const req = makeRequest('PATCH', 'u1')
    const result = await checkImpersonationBlock(req as any)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('blocks DELETE request when impersonation is active', async () => {
    mockFindOne.mockResolvedValue({
      id: 's1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      reason: 'Testing',
      expires_at: futureTime,
      status: 'active',
    })

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
    mockFindOne.mockResolvedValue({
      id: 's1',
      actor_internal_user_id: 'u1',
      organization_id: 'o1',
      reason: 'Testing',
      expires_at: expiresAt,
      status: 'active',
    })

    const req = makeRequest('POST', 'u1')
    const result = await checkImpersonationBlock(req as any)
    const body = await result!.json()
    expect(body.session_expires_at).toBe(expiresAt.toISOString())
  })

  it('allows HEAD requests during impersonation', async () => {
    mockFindOne.mockResolvedValue({
      id: 's1',
      actor_internal_user_id: 'u1',
      reason: 'Testing',
      expires_at: futureTime,
      status: 'active',
    })

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

describe('validateReason', () => {
  it('rejects null', () => {
    expect(validateReason(null)).toBe('REASON_REQUIRED')
  })

  it('rejects undefined', () => {
    expect(validateReason(undefined)).toBe('REASON_REQUIRED')
  })

  it('rejects empty string', () => {
    expect(validateReason('')).toBe('REASON_REQUIRED')
  })

  it('rejects whitespace-only string', () => {
    expect(validateReason('   ')).toBe('REASON_REQUIRED')
  })

  it('rejects non-string type', () => {
    expect(validateReason(123)).toBe('REASON_REQUIRED')
  })

  it('rejects reason shorter than 10 characters', () => {
    expect(validateReason('short')).toBe('REASON_TOO_SHORT')
  })

  it('accepts reason at minimum length', () => {
    expect(validateReason('x'.repeat(10))).toBeNull()
  })

  it('rejects reason longer than 500 characters', () => {
    expect(validateReason('x'.repeat(501))).toBe('REASON_TOO_LONG')
  })

  it('accepts reason at maximum length', () => {
    expect(validateReason('x'.repeat(500))).toBeNull()
  })

  it('strips whitespace when checking min length', () => {
    expect(validateReason('  abc  ')).toBe('REASON_TOO_SHORT')
  })

  it('accepts valid reason', () => {
    expect(validateReason('Investigating a billing issue for customer')).toBeNull()
  })
})
