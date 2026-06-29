import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/auth/session', () => ({
  ...jest.requireActual('@/lib/auth/session'),
  getInternalSession: jest.fn(),
}))

import { getInternalSession, InternalSessionUser } from '@/lib/auth/session'
import { requirePermission } from '@/lib/auth/requirePermission'
import type { InternalRoleName } from '@/lib/permission-matrix'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>

function mockRequest(headers: Record<string, string> = {}, cookies: Record<string, string> = {}): NextRequest {
  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  const url = 'http://localhost/api/test'
  return new NextRequest(url, {
    headers: { ...headers, ...(cookieStr ? { cookie: cookieStr } : {}) },
  })
}

const mockSessionUser: InternalSessionUser = {
  id: 'user-1',
  name: 'Test',
  surname: 'User',
  email: 'test@example.com',
  roleId: 'role-1',
  roleName: 'Super Admin' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-1',
}

const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('requirePermission()', () => {
  describe('authorized role', () => {
    it('calls the handler when role has permission', async () => {
      mockGetInternalSession.mockResolvedValue(mockSessionUser)

      const wrapped = requirePermission('tenant-ops', 'create')(handler)
      const req = mockRequest({ authorization: 'Bearer valid-token' })
      await wrapped(req)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(req, { internalUser: mockSessionUser })
    })
  })

  describe('unauthorized role', () => {
    it('returns 403 when role lacks permission', async () => {
      const viewerUser: InternalSessionUser = {
        ...mockSessionUser,
        roleName: 'Read-only Auditor' as InternalRoleName,
      }
      mockGetInternalSession.mockResolvedValue(viewerUser)

      const wrapped = requirePermission('tenant-ops', 'create')(handler)
      const req = mockRequest({ authorization: 'Bearer valid-token' })
      const res = await wrapped(req)

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('forbidden')
      expect(body.message).toBe('Insufficient permissions for this action')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('no session', () => {
    it('returns 401 when no auth header or cookie', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })

      const wrapped = requirePermission('leads', 'read')(handler)
      const req = mockRequest()
      const res = await wrapped(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('unauthorized')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('invalid session', () => {
    it('returns 401 for expired/invalid token', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Session not found or expired',
        status: 401,
      })

      const wrapped = requirePermission('leads', 'read')(handler)
      const req = mockRequest({ authorization: 'Bearer invalid-token' })
      const res = await wrapped(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('unauthorized')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('inactive/locked user', () => {
    it('returns 401 when account is not active', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Account inactive or locked',
        status: 401,
      })

      const wrapped = requirePermission('leads', 'read')(handler)
      const req = mockRequest({ authorization: 'Bearer valid-token' })
      const res = await wrapped(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.message).toBe('Account inactive or locked')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('no role assigned', () => {
    it('returns 403 when user has no role', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'forbidden',
        message: 'No role assigned',
        status: 403,
      })

      const wrapped = requirePermission('leads', 'read')(handler)
      const req = mockRequest({ authorization: 'Bearer valid-token' })
      const res = await wrapped(req)

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.message).toBe('No role assigned')
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('customer-facing role token', () => {
    it('rejects customer token with 401', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Session not found or expired',
        status: 401,
      })

      const wrapped = requirePermission('leads', 'read')(handler)
      const req = mockRequest({ authorization: 'Bearer customer-token' })
      const res = await wrapped(req)

      expect(res.status).toBe(401)
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
