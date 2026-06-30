import { ACTION_PERMISSIONS, SENSITIVE_ACTIONS, requirePermission, requireReason, PermissionError } from '@/lib/auth'

const mockOrg = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Org',
  status: 'active',
  domain: 'test.com',
  domain_verified: false,
  onboarding_status: 'in_progress',
  tenant_hash: 'abc123',
}

const mockUser = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'John',
  email: 'john@test.com',
  status: 'locked',
  organization_id: '00000000-0000-0000-0000-000000000001',
}

const mockAuthUser = {
  id: 'internal-user-1',
  name: 'Admin',
  surname: 'User',
  email: 'admin@example.com',
  internal_role_id: 'role-superadmin',
  roleName: 'Super Admin',
}

const mockSupportUser = {
  id: 'internal-user-2',
  name: 'Support',
  surname: 'User',
  email: 'support@example.com',
  internal_role_id: 'role-support',
  roleName: 'Support',
}

const mockFinanceUser = {
  id: 'internal-user-3',
  name: 'Finance',
  surname: 'User',
  email: 'finance@example.com',
  internal_role_id: 'role-finance',
  roleName: 'Finance',
}

const mockAuditorUser = {
  id: 'internal-user-4',
  name: 'Auditor',
  surname: 'User',
  email: 'auditor@example.com',
  internal_role_id: 'role-auditor',
  roleName: 'Read-only Auditor',
}

function mockSequelizeQuery(result: unknown[] = [], queryFn?: (sql: string, opts: unknown) => unknown) {
  return {
    sequelize: {
      query: queryFn || jest.fn().mockResolvedValue([result, []]),
    },
  }
}

function mockSequelizeIncremental(firstResult: unknown[], secondResult: unknown[]) {
  let callCount = 0
  const queryFn = jest.fn().mockImplementation(() => {
    callCount++
    if (callCount === 1) return Promise.resolve([firstResult, []])
    return Promise.resolve([secondResult, []])
  })
  return { sequelize: { query: queryFn } }
}

describe('requirePermission - unit tests', () => {
  it('allows Super Admin for all actions', () => {
    for (const actionKey of Object.keys(ACTION_PERMISSIONS)) {
      expect(() => requirePermission(mockAuthUser, actionKey)).not.toThrow()
    }
  })

  it('blocks Finance from all tenant actions', () => {
    for (const actionKey of Object.keys(ACTION_PERMISSIONS)) {
      expect(() => requirePermission(mockFinanceUser, actionKey)).toThrow(PermissionError)
    }
  })

  it('allows Support for resend_invite and unlock_user', () => {
    expect(() => requirePermission(mockSupportUser, 'tenant.resend_invite')).not.toThrow()
    expect(() => requirePermission(mockSupportUser, 'tenant.unlock_user')).not.toThrow()
  })

  it('blocks Support from reset_onboarding and force_verify_domain and disable', () => {
    expect(() => requirePermission(mockSupportUser, 'tenant.reset_onboarding')).toThrow(PermissionError)
    expect(() => requirePermission(mockSupportUser, 'tenant.force_verify_domain')).toThrow(PermissionError)
    expect(() => requirePermission(mockSupportUser, 'tenant.disable')).toThrow(PermissionError)
  })

  it('blocks Read-only Auditor from all actions', () => {
    for (const actionKey of Object.keys(ACTION_PERMISSIONS)) {
      expect(() => requirePermission(mockAuditorUser, actionKey)).toThrow(PermissionError)
    }
  })

  it('throws 400 for unknown action key', () => {
    expect(() => requirePermission(mockAuthUser, 'unknown.action')).toThrow(PermissionError)
    try {
      requirePermission(mockAuthUser, 'unknown.action')
    } catch (e: unknown) {
      expect((e as PermissionError).statusCode).toBe(400)
    }
  })
})

describe('requireReason - unit tests', () => {
  it('does not require reason for resend_invite', () => {
    expect(() => requireReason('tenant.resend_invite', undefined)).not.toThrow()
  })

  it('requires reason for disable_tenant', () => {
    expect(() => requireReason('tenant.disable', undefined)).toThrow(PermissionError)
    expect(() => requireReason('tenant.disable', '')).toThrow(PermissionError)
    expect(() => requireReason('tenant.disable', '  ')).toThrow(PermissionError)
  })

  it('requires reason for force_verify_domain', () => {
    expect(() => requireReason('tenant.force_verify_domain', null)).toThrow(PermissionError)
  })

  it('requires reason for reset_onboarding', () => {
    expect(() => requireReason('tenant.reset_onboarding', undefined)).toThrow(PermissionError)
  })

  it('requires reason for unlock_user', () => {
    expect(() => requireReason('tenant.unlock_user', '')).toThrow(PermissionError)
  })

  it('accepts valid reason for sensitive actions', () => {
    for (const actionKey of SENSITIVE_ACTIONS) {
      expect(() => requireReason(actionKey, 'Valid reason for action')).not.toThrow()
    }
  })

  it('rejects whitespace-only reason for sensitive actions', () => {
    for (const actionKey of SENSITIVE_ACTIONS) {
      expect(() => requireReason(actionKey, '   ')).toThrow(PermissionError)
    }
  })
})

describe('POST tenant support actions - route integration', () => {
  const orgId = '00000000-0000-0000-0000-000000000001'
  const badOrgId = '00000000-0000-0000-0000-000000009999'

  beforeEach(() => {
    jest.resetModules()
  })

  describe('validation', () => {
    it('returns 400 for invalid organization_id format', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery())

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/not-a-uuid/actions/disable_tenant', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ reason: 'Test reason' }),
      }) as never

      const response = await POST(request, { params: { organizationId: 'not-a-uuid', action: 'disable_tenant' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for unknown action', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery())

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/bad_action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ reason: 'Test' }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'bad_action' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 when organization not found', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery([]))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${badOrgId}/actions/disable_tenant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ reason: 'Test reason' }),
      }) as never

      const response = await POST(request, { params: { organizationId: badOrgId, action: 'disable_tenant' } })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })
  })

  describe('disable_tenant', () => {
    it('disables an active tenant successfully', async () => {
      const writeAuditMock = jest.fn().mockResolvedValue(undefined)
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: writeAuditMock }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery([mockOrg]))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/disable_tenant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'internal-user-1', 'x-forwarded-for': '10.0.0.1' },
        body: JSON.stringify({ reason: 'Tenant violating terms' }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'disable_tenant' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.action).toBe('disable_tenant')
      expect(body.organization_id).toBe(orgId)
      expect(body.message).toContain('disabled')

      expect(writeAuditMock).toHaveBeenCalledTimes(1)
      expect(writeAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.disable',
          target_type: 'organization',
          target_id: orgId,
          organization_id: orgId,
          actor_internal_user_id: 'internal-user-1',
          reason: 'Tenant violating terms',
          before_values: { status: 'active' },
          after_values: { status: 'disabled' },
        }),
      )
    })

    it('returns 422 when reason is missing for disable_tenant', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn().mockImplementation(() => {
          throw new PermissionError('Reason is required for this action', 422)
        }),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery([mockOrg]))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/disable_tenant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'internal-user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'disable_tenant' } })
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('blocks unauthorized role (Finance) from disabling tenant', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockFinanceUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn().mockImplementation(() => {
          throw new PermissionError("Role 'Finance' is not authorized to perform 'tenant.disable'", 403)
        }),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery([mockOrg]))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/disable_tenant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'finance-user' },
        body: JSON.stringify({ reason: 'Test' }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'disable_tenant' } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('resend_invite', () => {
    it('resends invite when pending invites exist', async () => {
      const writeAuditMock = jest.fn().mockResolvedValue(undefined)
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: writeAuditMock }))
      jest.doMock('@/lib/email', () => ({ sendMagicLinkEmail: jest.fn().mockResolvedValue(undefined) }))

      let queryCallCount = 0
      const queryFn = jest.fn().mockImplementation(() => {
        queryCallCount++
        if (queryCallCount === 1) return Promise.resolve([[mockOrg], []])
        if (queryCallCount === 2) return Promise.resolve([[{ email: 'admin@test.com' }], []])
        return Promise.resolve([[], []])
      })

      jest.doMock('@/lib/sequelize', () => ({ sequelize: { query: queryFn } }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/resend_invite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'internal-user-1', 'x-forwarded-for': '10.0.0.1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'resend_invite' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.action).toBe('resend_invite')
      expect(body.message).toContain('admin@test.com')

      expect(writeAuditMock).toHaveBeenCalledTimes(1)
      expect(writeAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.resend_invite',
          target_type: 'organization',
          organization_id: orgId,
          reason: null,
        }),
      )
    })

    it('returns graceful message when no pending invites exist', async () => {
      const writeAuditMock = jest.fn().mockResolvedValue(undefined)
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: writeAuditMock }))
      jest.doMock('@/lib/email', () => ({ sendMagicLinkEmail: jest.fn() }))

      let callIndex = 0
      const queryFn = jest.fn().mockImplementation(() => {
        callIndex++
        if (callIndex === 1) return Promise.resolve([[mockOrg], []])
        return Promise.resolve([[], []])
      })
      jest.doMock('@/lib/sequelize', () => ({ sequelize: { query: queryFn } }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/resend_invite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'internal-user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'resend_invite' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.message).toContain('No pending invites')
    })

    it('blocks unauthorized role from resending invite', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockFinanceUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn().mockImplementation(() => {
          throw new PermissionError("Role 'Finance' is not authorized to perform 'tenant.resend_invite'", 403)
        }),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery())

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/resend_invite`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'finance-user' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'resend_invite' } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('unlock_user', () => {
    it('unlocks a locked user successfully', async () => {
      const writeAuditMock = jest.fn().mockResolvedValue(undefined)
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: writeAuditMock }))

      let callIndex = 0
      const queryFn = jest.fn().mockImplementation(() => {
        callIndex++
        if (callIndex === 1) return Promise.resolve([[mockOrg], []])
        if (callIndex === 2) return Promise.resolve([[mockUser], []])
        return Promise.resolve([[], []])
      })
      jest.doMock('@/lib/sequelize', () => ({ sequelize: { query: queryFn } }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/unlock_user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'internal-user-1', 'x-forwarded-for': '10.0.0.1' },
        body: JSON.stringify({ reason: 'User was locked by mistake', user_id: mockUser.id }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'unlock_user' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.action).toBe('unlock_user')
      expect(body.message).toContain('john@test.com')

      expect(writeAuditMock).toHaveBeenCalledTimes(1)
      expect(writeAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.unlock_user',
          target_type: 'customer_user',
          target_id: mockUser.id,
          organization_id: orgId,
          before_values: expect.objectContaining({ user_id: mockUser.id, user_status: 'locked' }),
          after_values: expect.objectContaining({ user_id: mockUser.id, user_status: 'active' }),
        }),
      )
    })

    it('returns 422 when user_id is missing for unlock_user', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery([mockOrg]))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/unlock_user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'internal-user-1' },
        body: JSON.stringify({ reason: 'Test reason' }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'unlock_user' } })
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 when user is not found', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))

      let callIdx = 0
      const queryFn = jest.fn().mockImplementation(() => {
        callIdx++
        if (callIdx === 1) return Promise.resolve([[mockOrg], []])
        return Promise.resolve([[], []])
      })
      jest.doMock('@/lib/sequelize', () => ({ sequelize: { query: queryFn } }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/unlock_user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'internal-user-1' },
        body: JSON.stringify({ reason: 'Test', user_id: '00000000-0000-0000-0000-000000009999' }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'unlock_user' } })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('blocks unauthorized role (Finance) from unlocking user', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockFinanceUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn().mockImplementation(() => {
          throw new PermissionError("Role 'Finance' is not authorized to perform 'tenant.unlock_user'", 403)
        }),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery())

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/unlock_user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'finance-user' },
        body: JSON.stringify({ reason: 'Test', user_id: mockUser.id }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'unlock_user' } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('force_verify_domain', () => {
    it('force-verifies domain successfully', async () => {
      const writeAuditMock = jest.fn().mockResolvedValue(undefined)
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: writeAuditMock }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery([mockOrg]))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/force_verify_domain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'internal-user-1' },
        body: JSON.stringify({ reason: 'Customer verified domain manually' }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'force_verify_domain' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.action).toBe('force_verify_domain')

      expect(writeAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.force_verify_domain',
          before_values: { domain_verified: false },
          after_values: { domain_verified: true },
        }),
      )
    })

    it('blocks unauthorized role', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockSupportUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn().mockImplementation(() => {
          throw new PermissionError("Role 'Support' is not authorized to perform 'tenant.force_verify_domain'", 403)
        }),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery())

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/force_verify_domain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'support-user' },
        body: JSON.stringify({ reason: 'Test' }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'force_verify_domain' } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('reset_onboarding', () => {
    it('resets onboarding status successfully', async () => {
      const writeAuditMock = jest.fn().mockResolvedValue(undefined)
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockAuthUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn(),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: writeAuditMock }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery([mockOrg]))

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/reset_onboarding`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'internal-user-1' },
        body: JSON.stringify({ reason: 'Restarting onboarding process' }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'reset_onboarding' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.action).toBe('reset_onboarding')

      expect(writeAuditMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.reset_onboarding',
          before_values: { onboarding_status: 'in_progress' },
          after_values: { onboarding_status: 'not_started' },
        }),
      )
    })

    it('blocks unauthorized role (Finance)', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue(mockFinanceUser),
        requireMutationAuth: jest.fn(),
        requirePermission: jest.fn().mockImplementation(() => {
          throw new PermissionError("Role 'Finance' is not authorized to perform 'tenant.reset_onboarding'", 403)
        }),
        requireReason: jest.fn(),
      }))
      jest.doMock('@/lib/sequelize', () => mockSequelizeQuery())

      const { POST } = await import('@/app/api/v1/internal/tenants/[organizationId]/actions/[action]/route')
      const request = new Request(`http://localhost/api/v1/internal/tenants/${orgId}/actions/reset_onboarding`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'finance-user' },
        body: JSON.stringify({ reason: 'Test' }),
      }) as never

      const response = await POST(request, { params: { organizationId: orgId, action: 'reset_onboarding' } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })
})
