jest.mock('@/lib/models/InternalSession', () => ({
  InternalSession: {
    findOne: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
}))

jest.mock('@/lib/models/InternalUser', () => ({
  InternalUser: { findByPk: jest.fn() },
}))

jest.mock('@/lib/models/InternalRole', () => ({
  InternalRole: { findByPk: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { InternalSession } from '@/lib/models/InternalSession'
import { InternalUser } from '@/lib/models/InternalUser'
import { InternalRole } from '@/lib/models/InternalRole'
import { getInternalSession, isSessionError, InternalSessionUser } from '@/lib/auth/session'

const mockFindSession = InternalSession.findOne as jest.MockedFunction<typeof InternalSession.findOne>
const mockUpdateSession = InternalSession.update as jest.MockedFunction<typeof InternalSession.update>
const mockFindUser = InternalUser.findByPk as jest.MockedFunction<typeof InternalUser.findByPk>
const mockFindRole = InternalRole.findByPk as jest.MockedFunction<typeof InternalRole.findByPk>

function mockRequest(headers: Record<string, string> = {}, cookies: Record<string, string> = {}): NextRequest {
  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return new NextRequest('http://localhost/api/test', {
    headers: { ...headers, ...(cookieStr ? { cookie: cookieStr } : {}) },
  })
}

const validToken = 'ab'.repeat(32)
const VALID_AT = new Date(Date.now() + 3600000)

function mockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    internal_user_id: 'user-1',
    token_hash: 'fakehash',
    expires_at: VALID_AT,
    idle_expires_at: VALID_AT,
    destroy: jest.fn(),
    ...overrides,
  } as never
}

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Test',
    surname: 'User',
    email: 'test@example.com',
    internal_role_id: 'role-1',
    status: 'active',
    totp_enabled: true,
    get: () => undefined,
    ...overrides,
  } as never
}

function mockRole(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-1',
    name: 'Super Admin',
    is_active: true,
    ...overrides,
  } as never
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getInternalSession()', () => {
  describe('no token provided', () => {
    it('returns unauthorized when no auth header or cookie', async () => {
      const req = mockRequest()
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(true)
      if (isSessionError(result)) {
        expect(result.error).toBe('unauthorized')
        expect(result.message).toBe('Authentication required')
        expect(result.status).toBe(401)
      }
    })
  })

  describe('invalid token format', () => {
    it('returns unauthorized for non-hex token', async () => {
      const req = mockRequest({ authorization: 'Bearer not-a-valid-token' })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(true)
      if (isSessionError(result)) {
        expect(result.error).toBe('unauthorized')
        expect(result.message).toBe('Authentication required')
      }
    })
  })

  describe('session not found', () => {
    it('returns unauthorized when session does not exist', async () => {
      mockFindSession.mockResolvedValue(null)

      const req = mockRequest({ authorization: `Bearer ${validToken}` })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(true)
      if (isSessionError(result)) {
        expect(result.error).toBe('unauthorized')
        expect(result.message).toBe('Session not found or expired')
        expect(result.status).toBe(401)
      }
    })
  })

  describe('expired session', () => {
    it('returns unauthorized when session is expired and destroys it', async () => {
      const destroyFn = jest.fn()
      mockFindSession.mockResolvedValue(mockSession({
        expires_at: new Date(Date.now() - 3600000),
        destroy: destroyFn,
      }))

      const req = mockRequest({ authorization: `Bearer ${validToken}` })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(true)
      if (isSessionError(result)) {
        expect(result.error).toBe('unauthorized')
        expect(result.message).toBe('Session expired')
      }
      expect(destroyFn).toHaveBeenCalled()
    })
  })

  describe('idle session expired', () => {
    it('returns unauthorized when idle timeout has passed', async () => {
      const destroyFn = jest.fn()
      mockFindSession.mockResolvedValue(mockSession({
        idle_expires_at: new Date(Date.now() - 600000),
        destroy: destroyFn,
      }))

      const req = mockRequest({ authorization: `Bearer ${validToken}` })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(true)
      if (isSessionError(result)) {
        expect(result.error).toBe('unauthorized')
        expect(result.message).toBe('Session expired due to inactivity')
      }
      expect(destroyFn).toHaveBeenCalled()
    })
  })

  describe('user not found', () => {
    it('returns unauthorized when user does not exist', async () => {
      mockFindSession.mockResolvedValue(mockSession())
      mockFindUser.mockResolvedValue(null)

      const req = mockRequest({ authorization: `Bearer ${validToken}` })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(true)
      if (isSessionError(result)) {
        expect(result.error).toBe('unauthorized')
        expect(result.message).toBe('User no longer exists')
        expect(result.status).toBe(401)
      }
    })
  })

  describe('inactive user', () => {
    it('returns unauthorized when user status is inactive', async () => {
      mockFindSession.mockResolvedValue(mockSession())
      mockFindUser.mockResolvedValue(mockUser({ status: 'inactive' }))

      const req = mockRequest({ authorization: `Bearer ${validToken}` })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(true)
      if (isSessionError(result)) {
        expect(result.error).toBe('unauthorized')
        expect(result.message).toBe('Account inactive or locked')
        expect(result.status).toBe(401)
      }
    })
  })

  describe('no role assigned', () => {
    it('returns forbidden when internal_role_id is null', async () => {
      mockFindSession.mockResolvedValue(mockSession())
      mockFindUser.mockResolvedValue(mockUser({ internal_role_id: null }))

      const req = mockRequest({ authorization: `Bearer ${validToken}` })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(true)
      if (isSessionError(result)) {
        expect(result.error).toBe('forbidden')
        expect(result.message).toBe('No role assigned')
        expect(result.status).toBe(403)
      }
    })
  })

  describe('role not found', () => {
    it('returns forbidden when role does not exist', async () => {
      mockFindSession.mockResolvedValue(mockSession())
      mockFindUser.mockResolvedValue(mockUser())
      mockFindRole.mockResolvedValue(null)

      const req = mockRequest({ authorization: `Bearer ${validToken}` })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(true)
      if (isSessionError(result)) {
        expect(result.error).toBe('forbidden')
        expect(result.message).toBe('No role assigned')
        expect(result.status).toBe(403)
      }
    })
  })

  describe('successful session extraction', () => {
    it('returns session user from Authorization header', async () => {
      mockFindSession.mockResolvedValue(mockSession())
      mockFindUser.mockResolvedValue(mockUser())
      mockFindRole.mockResolvedValue(mockRole())
      mockUpdateSession.mockResolvedValue([1])

      const req = mockRequest({ authorization: `Bearer ${validToken}` })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(false)
      if (!isSessionError(result)) {
        expect(result.id).toBe('user-1')
        expect(result.roleName).toBe('Super Admin')
        expect(result.status).toBe('active')
        expect(result.sessionId).toBe('session-1')
      }
    })

    it('returns session user from cookie', async () => {
      mockFindSession.mockResolvedValue(mockSession())
      mockFindUser.mockResolvedValue(mockUser())
      mockFindRole.mockResolvedValue(mockRole())
      mockUpdateSession.mockResolvedValue([1])

      const req = mockRequest({}, { internal_session: validToken })
      const result = await getInternalSession(req)

      expect(isSessionError(result)).toBe(false)
      if (!isSessionError(result)) {
        expect(result.id).toBe('user-1')
        expect(result.roleName).toBe('Super Admin')
      }
    })
  })
})
