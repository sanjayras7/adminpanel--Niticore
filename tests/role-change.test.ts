import { NextRequest } from 'next/server'

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
    deleted_at: null,
    save: mockSave,
    ...overrides,
  })
  const mockRole = (overrides: Record<string, any> = {}) => ({
    id: 'role-super-admin',
    name: 'Super Admin',
    description: 'Full access',
    is_active: true,
    ...overrides,
  })
  return {
    InternalUser: { findByPk: jest.fn() },
    InternalRole: { findByPk: jest.fn() },
    InternalAuditEvent: { create: jest.fn() },
    __mockUser: mockUser,
    __mockRole: mockRole,
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
import { InternalUser, InternalRole, InternalAuditEvent } from '@/lib/models'
import { PATCH } from '@/app/api/v1/internal/users/[userId]/role/route'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>
const mockFindUser = InternalUser.findByPk as jest.MockedFunction<typeof InternalUser.findByPk>
const mockFindRole = InternalRole.findByPk as jest.MockedFunction<typeof InternalRole.findByPk>
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
    deleted_at: null,
    save,
    ...overrides,
  }
}

function makeRole(overrides: Record<string, any> = {}) {
  return {
    id: 'role-super-admin',
    name: 'Super Admin',
    description: 'Full access to everything',
    is_active: true,
    ...overrides,
  }
}

function req(body: unknown, pathUserId = TARGET_USER_ID, ip = '127.0.0.1'): NextRequest {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
    nextUrl: { pathname: `/api/v1/internal/users/${pathUserId}/role` },
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  const { sequelize } = require('@/lib/sequelize')
  sequelize.transaction.mockImplementation(async (callback: (t: any) => Promise<any>) => {
    const t = {}
    return callback(t)
  })
})

describe('PATCH /api/v1/internal/users/:userId/role', () => {
  describe('authorization', () => {
    it('returns 200 for Super Admin changing another user role', async () => {
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
      mockFindUser.mockImplementation(async (id: string) => {
        if (id === TARGET_USER_ID) return makeUser()
        return null
      })
      mockFindRole.mockImplementation(async (id: string) => {
        if (id === 'role-super-admin') return makeRole()
        return null
      })
      mockAuditCreate.mockResolvedValue({} as any)

      const res = await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted to Super Admin' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(TARGET_USER_ID)
      expect(body.internal_role_id).toBe('role-super-admin')
      expect(body.internal_role.name).toBe('Super Admin')
    })
  })

  describe('authorization failures', () => {
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

      const res = await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted' }))
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

      const res = await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted' }))
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('unauthorized')
    })
  })

  describe('input validation', () => {
    beforeEach(() => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)
    })

    it('returns 400 when roleId is missing', async () => {
      const res = await PATCH(req({ reason: 'Promoted' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_request')
      expect(body.message).toContain('roleId')
    })

    it('returns 400 when roleId is not a string', async () => {
      const res = await PATCH(req({ roleId: 12345, reason: 'Promoted' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when reason is missing', async () => {
      const res = await PATCH(req({ roleId: 'role-super-admin' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_request')
      expect(body.message).toContain('reason')
    })

    it('returns 400 when reason is empty string', async () => {
      const res = await PATCH(req({ roleId: 'role-super-admin', reason: '' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when reason is whitespace-only', async () => {
      const res = await PATCH(req({ roleId: 'role-super-admin', reason: '   ' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid JSON body', async () => {
      const badReq = {
        json: async () => { throw new Error('parse error') },
        headers: new Headers(),
        nextUrl: { pathname: `/api/v1/internal/users/${TARGET_USER_ID}/role` },
      } as unknown as NextRequest
      const res = await PATCH(badReq)
      expect(res.status).toBe(400)
    })
  })

  describe('self-change prevention', () => {
    it('returns 409 when Super Admin tries to change their own role', async () => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)

      const res = await PATCH(req({ roleId: 'role-implementation', reason: 'Demotion' }, SUPER_ADMIN_ID))
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('forbidden')
      expect(body.message).toContain('Cannot change your own role')
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
      mockFindUser.mockResolvedValue(null)

      const res = await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted' }))
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
      expect(body.message).toBe('User not found')
    })

    it('returns 404 when target user is soft-deleted', async () => {
      mockFindUser.mockResolvedValue(makeUser({ deleted_at: new Date() }))

      const res = await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted' }))
      expect(res.status).toBe(404)
    })

    it('returns 500 when user database lookup fails', async () => {
      mockFindUser.mockRejectedValue(new Error('DB connection failed'))

      const res = await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted' }))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('server_error')
    })
  })

  describe('role validation', () => {
    beforeEach(() => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)
      mockFindUser.mockResolvedValue(makeUser())
    })

    it('returns 400 when target role does not exist', async () => {
      mockFindRole.mockResolvedValue(null)

      const res = await PATCH(req({ roleId: 'nonexistent-role', reason: 'Promoted' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_request')
      expect(body.message).toBe('Invalid role')
    })

    it('returns 400 when target role is inactive', async () => {
      mockFindRole.mockResolvedValue(makeRole({ is_active: false }))

      const res = await PATCH(req({ roleId: 'role-inactive', reason: 'Promoted' }))
      expect(res.status).toBe(400)
    })

    it('returns 500 when role database lookup fails', async () => {
      mockFindRole.mockRejectedValue(new Error('DB connection failed'))

      const res = await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted' }))
      expect(res.status).toBe(500)
    })
  })

  describe('audit event creation', () => {
    it('creates audit event with correct before/after role values', async () => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)
      const user = makeUser({ internal_role_id: 'role-implementation' })
      mockFindUser.mockResolvedValue(user)
      mockFindRole.mockImplementation(async (id: string) => {
        if (id === 'role-super-admin') return makeRole()
        if (id === 'role-implementation') return makeRole({ id: 'role-implementation', name: 'Implementation Manager' })
        return null
      })
      mockAuditCreate.mockResolvedValue({} as any)

      await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted to Super Admin' }))

      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_internal_user_id: SUPER_ADMIN_ID,
          actor_role: 'Super Admin',
          action: 'internal_user.role.change',
          target_type: 'internal_user',
          target_id: TARGET_USER_ID,
          before_values: { role_id: 'role-implementation', role_name: 'Implementation Manager' },
          after_values: { role_id: 'role-super-admin', role_name: 'Super Admin' },
          reason: 'Promoted to Super Admin',
        }),
        expect.any(Object),
      )
    })

    it('creates audit event with null before_role when user had no role', async () => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)
      const user = makeUser({ internal_role_id: null })
      mockFindUser.mockResolvedValue(user)
      mockFindRole.mockImplementation(async (id: string) => {
        if (id === 'role-super-admin') return makeRole()
        return null
      })
      mockAuditCreate.mockResolvedValue({} as any)

      await PATCH(req({ roleId: 'role-super-admin', reason: 'Assigning first role' }))

      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          before_values: { role_id: null, role_name: null },
        }),
        expect.any(Object),
      )
    })
  })

  describe('transaction failure', () => {
    it('returns 500 when transaction fails', async () => {
      mockGetInternalSession.mockResolvedValue({
        id: SUPER_ADMIN_ID,
        roleName: 'Super Admin',
      } as any)
      mockFindUser.mockResolvedValue(makeUser())
      mockFindRole.mockResolvedValue(makeRole())
      const { sequelize } = require('@/lib/sequelize')
      sequelize.transaction.mockRejectedValue(new Error('Transaction failed'))

      const res = await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted' }))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('server_error')
    })
  })

  describe('response shape', () => {
    it('returns the updated user object with new role info', async () => {
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
      mockFindUser.mockResolvedValue(makeUser())
      mockFindRole.mockImplementation(async (id: string) => {
        if (id === 'role-super-admin') return makeRole()
        if (id === 'role-implementation') return makeRole({ id: 'role-implementation', name: 'Implementation Manager' })
        return null
      })
      mockAuditCreate.mockResolvedValue({} as any)

      const res = await PATCH(req({ roleId: 'role-super-admin', reason: 'Promoted' }))
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body).toHaveProperty('id', TARGET_USER_ID)
      expect(body).toHaveProperty('name', 'Target')
      expect(body).toHaveProperty('surname', 'User')
      expect(body).toHaveProperty('email', 'target@niticore.com')
      expect(body).toHaveProperty('internal_role_id', 'role-super-admin')
      expect(body.internal_role).toEqual({
        id: 'role-super-admin',
        name: 'Super Admin',
        description: 'Full access to everything',
      })
      expect(body).toHaveProperty('status', 'active')
    })
  })
})
