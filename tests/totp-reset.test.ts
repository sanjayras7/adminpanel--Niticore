import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/auth/session', () => ({
  getInternalSession: jest.fn(),
  isSessionError: jest.fn((r: any) => 'error' in r),
}))

jest.mock('@/lib/models', () => {
  const mockSave = jest.fn().mockResolvedValue(undefined)
  const mockUser = (overrides: Record<string, any> = {}) => ({
    id: 'target-user-uuid-2222',
    name: 'Target',
    surname: 'User',
    email: 'target@niticore.com',
    internal_role_id: 'role-implementation',
    status: 'active',
    totp_enabled: true,
    totp_secret_encrypted: 'encrypted-secret-value',
    totp_enrolled_at: new Date('2026-06-01'),
    last_totp_verified_at: new Date('2026-06-25'),
    failed_totp_attempt_count: 0,
    locked_until: null,
    totp_reset_at: null,
    totp_reset_by: null,
    totp_reset_reason: null,
    save: mockSave,
    ...overrides,
  })
  return {
    InternalUser: { findByPk: jest.fn() },
    InternalAuditEvent: { create: jest.fn() },
    __mockUser: mockUser,
    __mockSave: mockSave,
  }
})

jest.mock('@/lib/sequelize', () => ({
  sequelize: {
    transaction: jest.fn(async (callback: (t: any) => Promise<any>) => {
      const t = {}
      return callback(t)
    }),
  },
}))

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('audit-event-uuid-12345'),
}))

import { getInternalSession } from '@/lib/auth/session'
import { InternalUser, InternalAuditEvent } from '@/lib/models'
import { POST } from '@/app/api/v1/internal/auth/admin/totp-reset/route'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>
const mockFindByPk = InternalUser.findByPk as jest.MockedFunction<typeof InternalUser.findByPk>
const mockAuditCreate = InternalAuditEvent.create as jest.MockedFunction<typeof InternalAuditEvent.create>

const SUPER_ADMIN_ID = 'super-admin-uuid-1111'
const TARGET_USER_ID = 'target-user-uuid-2222'

function makeUser(overrides: Record<string, any> = {}) {
  const save = jest.fn().mockResolvedValue(undefined)
  return {
    id: TARGET_USER_ID,
    name: 'Target',
    surname: 'User',
    email: 'target@niticore.com',
    internal_role_id: 'role-implementation',
    status: 'active',
    totp_enabled: true,
    totp_secret_encrypted: 'encrypted-secret-value',
    totp_enrolled_at: new Date('2026-06-01'),
    last_totp_verified_at: new Date('2026-06-25'),
    failed_totp_attempt_count: 0,
    locked_until: null,
    totp_reset_at: null,
    totp_reset_by: null,
    totp_reset_reason: null,
    save,
    ...overrides,
  }
}

function req(body: unknown, ip = '127.0.0.1'): NextRequest {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/v1/internal/auth/admin/totp-reset', () => {
  describe('authorization (requirePermission integration)', () => {
    it('returns 200 for Super Admin resetting another user', async () => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        name: 'Super',
        surname: 'Admin',
        email: 'super@niticore.com',
        roleId: 'role-super-admin',
        roleName: 'Super Admin',
        status: 'active',
        totpEnabled: true,
        sessionId: 'session-12345',
      })
      mockFindByPk.mockImplementation(async (id: string) => {
        if (id === TARGET_USER_ID) return makeUser()
        return null
      })

      const res = await POST(req({
        internal_user_id: TARGET_USER_ID,
        reason: 'Lost authenticator device',
      }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toBe('TOTP enrollment reset. User must re-enroll at next login.')
    })

    it('clears all TOTP fields and sets reset metadata', async () => {
      const save = jest.fn().mockResolvedValue(undefined)
      const user = makeUser({ save })
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)
      mockFindByPk.mockResolvedValue(user)
      mockAuditCreate.mockResolvedValue({} as any)

      await POST(req({
        internal_user_id: TARGET_USER_ID,
        reason: 'Security concern',
      }))

      expect(user.totp_enabled).toBe(false)
      expect(user.totp_secret_encrypted).toBe(null)
      expect(user.totp_enrolled_at).toBe(null)
      expect(user.last_totp_verified_at).toBe(null)
      expect(user.failed_totp_attempt_count).toBe(0)
      expect(user.locked_until).toBe(null)
      expect(user.totp_reset_at).toBeInstanceOf(Date)
      expect(user.totp_reset_by).toBe(SUPER_ADMIN_ID)
      expect(user.totp_reset_reason).toBe('Security concern')
      expect(save).toHaveBeenCalledTimes(1)
    })

    it('creates an audit event with the correct shape', async () => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)
      mockFindByPk.mockResolvedValue(makeUser())
      mockAuditCreate.mockResolvedValue({} as any)

      await POST(req({
        internal_user_id: TARGET_USER_ID,
        reason: 'Lost device',
      }))

      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_internal_user_id: SUPER_ADMIN_ID,
          actor_role: 'Super Admin',
          action: 'totp_reset',
          target_id: TARGET_USER_ID,
          target_type: 'internal_user',
          reason: 'Lost device',
          before_values: { totp_enabled: true, totp_secret_encrypted: '[redacted]' },
          after_values: { totp_enabled: false, totp_secret_encrypted: null },
        }),
        expect.any(Object),
      )
    })
  })

  describe('input validation', () => {
    beforeEach(() => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)
    })

    it('returns 422 when internal_user_id is missing', async () => {
      const res = await POST(req({ reason: 'Lost device' }))
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe('validation_error')
      expect(body.message).toContain('internal_user_id')
    })

    it('returns 422 when internal_user_id is not a string', async () => {
      const res = await POST(req({ internal_user_id: 12345, reason: 'Lost device' }))
      expect(res.status).toBe(422)
    })

    it('returns 422 when reason is missing', async () => {
      const res = await POST(req({ internal_user_id: TARGET_USER_ID }))
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe('validation_error')
      expect(body.message).toContain('reason')
    })

    it('returns 422 when reason is empty string', async () => {
      const res = await POST(req({ internal_user_id: TARGET_USER_ID, reason: '' }))
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe('validation_error')
      expect(body.message).toContain('reason')
    })

    it('returns 422 when reason is whitespace-only', async () => {
      const res = await POST(req({ internal_user_id: TARGET_USER_ID, reason: '   ' }))
      expect(res.status).toBe(422)
    })

    it('returns 400 for invalid JSON body', async () => {
      const badReq = {
        json: async () => { throw new Error('parse error') },
        headers: new Headers(),
      } as unknown as NextRequest
      const res = await POST(badReq)
      expect(res.status).toBe(400)
    })
  })

  describe('self-reset prevention', () => {
    it('returns 403 when admin tries to reset their own TOTP', async () => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)

      const res = await POST(req({
        internal_user_id: SUPER_ADMIN_ID,
        reason: 'Test reason',
      }))
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('forbidden')
      expect(body.message).toContain('Cannot reset your own TOTP')
    })
  })

  describe('target user resolution', () => {
    beforeEach(() => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)
    })

    it('returns 404 when target user does not exist', async () => {
      mockFindByPk.mockResolvedValue(null)

      const res = await POST(req({
        internal_user_id: TARGET_USER_ID,
        reason: 'Lost device',
      }))
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
      expect(body.message).toBe('User not found')
    })

    it('returns 500 when database lookup fails', async () => {
      mockFindByPk.mockRejectedValue(new Error('DB connection failed'))

      const res = await POST(req({
        internal_user_id: TARGET_USER_ID,
        reason: 'Lost device',
      }))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('server_error')
    })

    it('returns 500 when transaction fails', async () => {
      mockFindByPk.mockResolvedValue(makeUser())
      const { sequelize } = require('@/lib/sequelize')
      sequelize.transaction.mockRejectedValue(new Error('Transaction failed'))

      const res = await POST(req({
        internal_user_id: TARGET_USER_ID,
        reason: 'Lost device',
      }))
      expect(res.status).toBe(500)
    })
  })

  describe('non-admin authorization (delegated to requirePermission)', () => {
    it('returns 403 for non-Super-Admin role', async () => {
      mockGetInternalSession.mockResolvedValue({
        id: 'some-im-id',
        name: 'IM',
        surname: 'User',
        email: 'im@niticore.com',
        roleId: 'role-im',
        roleName: 'Implementation Manager',
        status: 'active',
        totpEnabled: false,
        sessionId: 'session-im',
      })

      const res = await POST(req({
        internal_user_id: TARGET_USER_ID,
        reason: 'Lost device',
      }))
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('forbidden')
    })

    it('returns 401 when not authenticated', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })

      const res = await POST(req({
        internal_user_id: TARGET_USER_ID,
        reason: 'Lost device',
      }))
      expect(res.status).toBe(401)
    })
  })
})
