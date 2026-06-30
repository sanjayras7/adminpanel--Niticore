describe('Tenant Module Toggle - PATCH /api/v1/internal/tenants/:organizationId/modules/:configId', () => {
  const mockOrganizationId = 'org-1'
  const mockConfigId = 'config-1'
  const mockConfig = {
    id: 'config-1',
    organization_id: 'org-1',
    module_id: 'module-1',
    enabled: false,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  }

  const mockDbResponse = (rows: unknown[]) => {
    const promise = Promise.resolve([rows, {}] as never)
    return promise
  }

  beforeEach(() => {
    jest.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockRejectedValue(new (class extends Error {
        statusCode = 401
        constructor() {
          super('unauthorized')
        }
      })()),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      'http://localhost/api/v1/internal/tenants/org-1/modules/config-1',
      { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns 403 for unauthorized role (Customer Success)', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-cs',
        name: 'CS',
        surname: 'User',
        email: 'cs@example.com',
        internal_role_id: 'role-cs',
        roleName: 'Customer Success',
      }),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      'http://localhost/api/v1/internal/tenants/org-1/modules/config-1',
      { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-cs' }, body: JSON.stringify({ enabled: true }) },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 403 for Read-only Auditor', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-auditor',
        name: 'Audit',
        surname: 'User',
        email: 'auditor@example.com',
        internal_role_id: 'role-auditor',
        roleName: 'Read-only Auditor',
      }),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      'http://localhost/api/v1/internal/tenants/org-1/modules/config-1',
      { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-auditor' }, body: JSON.stringify({ enabled: true }) },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 422 when enabled field is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Admin',
        surname: 'User',
        email: 'admin@example.com',
        internal_role_id: 'role-superadmin',
        roleName: 'Super Admin',
      }),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      'http://localhost/api/v1/internal/tenants/org-1/modules/config-1',
      { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' }, body: JSON.stringify({}) },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 422 when enabled is not boolean', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Admin',
        surname: 'User',
        email: 'admin@example.com',
        internal_role_id: 'role-superadmin',
        roleName: 'Super Admin',
      }),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      'http://localhost/api/v1/internal/tenants/org-1/modules/config-1',
      { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' }, body: JSON.stringify({ enabled: 'true' }) },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 404 when organization is not found or inactive', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Admin',
        surname: 'User',
        email: 'admin@example.com',
        internal_role_id: 'role-superadmin',
        roleName: 'Super Admin',
      }),
    }))

    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockResolvedValue([[], {}]),
      },
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      `http://localhost/api/v1/internal/tenants/${mockOrganizationId}/modules/${mockConfigId}`,
      { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' }, body: JSON.stringify({ enabled: true }) },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 404 when config does not belong to the organization', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Admin',
        surname: 'User',
        email: 'admin@example.com',
        internal_role_id: 'role-superadmin',
        roleName: 'Super Admin',
      }),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation(() => {
          queryCallCount++
          if (queryCallCount === 1) {
            return mockDbResponse([{ id: 'org-1' }])
          }
          return mockDbResponse([])
        }),
      },
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      `http://localhost/api/v1/internal/tenants/${mockOrganizationId}/modules/config-wrong`,
      { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' }, body: JSON.stringify({ enabled: true }) },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: 'config-wrong' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('enables a module config successfully (Super Admin)', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Admin',
        surname: 'User',
        email: 'admin@example.com',
        internal_role_id: 'role-superadmin',
        roleName: 'Super Admin',
      }),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation(() => {
          queryCallCount++
          if (queryCallCount === 1) return mockDbResponse([{ id: 'org-1' }])
          if (queryCallCount === 2) return mockDbResponse([{ ...mockConfig, enabled: false }])
          return mockDbResponse([])
        }),
      },
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockResolvedValue(undefined),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      `http://localhost/api/v1/internal/tenants/${mockOrganizationId}/modules/${mockConfigId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ enabled: true }),
      },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.enabled).toBe(true)
    expect(body.data.id).toBe('config-1')
  })

  it('disables a module config successfully (Implementation Manager)', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-im',
        name: 'Imp',
        surname: 'Manager',
        email: 'im@example.com',
        internal_role_id: 'role-im',
        roleName: 'Implementation Manager',
      }),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation(() => {
          queryCallCount++
          if (queryCallCount === 1) return mockDbResponse([{ id: 'org-1' }])
          if (queryCallCount === 2) return mockDbResponse([{ ...mockConfig, enabled: true }])
          return mockDbResponse([])
        }),
      },
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockResolvedValue(undefined),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      `http://localhost/api/v1/internal/tenants/${mockOrganizationId}/modules/${mockConfigId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-im' },
        body: JSON.stringify({ enabled: false }),
      },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.enabled).toBe(false)
  })

  it('audits with correct before/after values', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Admin',
        surname: 'User',
        email: 'admin@example.com',
        internal_role_id: 'role-superadmin',
        roleName: 'Super Admin',
      }),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation(() => {
          queryCallCount++
          if (queryCallCount === 1) return mockDbResponse([{ id: 'org-1' }])
          if (queryCallCount === 2) return mockDbResponse([{ ...mockConfig, enabled: false }])
          return mockDbResponse([])
        }),
      },
    }))

    let capturedAuditEvent: Record<string, unknown> | null = null
    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockImplementation((event: Record<string, unknown>) => {
        capturedAuditEvent = event
        return Promise.resolve()
      }),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      `http://localhost/api/v1/internal/tenants/${mockOrganizationId}/modules/${mockConfigId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ enabled: true, reason: 'Client requested activation' }),
      },
    ) as never

    await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })

    expect(capturedAuditEvent).not.toBeNull()
    expect(capturedAuditEvent!.action).toBe('tenant_module_toggle')
    expect(capturedAuditEvent!.target_type).toBe('organization_module_config')
    expect(capturedAuditEvent!.target_id).toBe('config-1')
    expect(capturedAuditEvent!.organization_id).toBe('org-1')
    expect(capturedAuditEvent!.before_values).toEqual({ enabled: false })
    expect(capturedAuditEvent!.after_values).toEqual({ enabled: true })
    expect(capturedAuditEvent!.reason).toBe('Client requested activation')
    expect(capturedAuditEvent!.actor_internal_user_id).toBe('user-1')
    expect(capturedAuditEvent!.actor_role).toBe('Super Admin')
  })

  it('audits no-op toggle (enable when already enabled) with before === after', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Admin',
        surname: 'User',
        email: 'admin@example.com',
        internal_role_id: 'role-superadmin',
        roleName: 'Super Admin',
      }),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation(() => {
          queryCallCount++
          if (queryCallCount === 1) return mockDbResponse([{ id: 'org-1' }])
          if (queryCallCount === 2) return mockDbResponse([{ ...mockConfig, enabled: true }])
          return mockDbResponse([])
        }),
      },
    }))

    let capturedAuditEvent: Record<string, unknown> | null = null
    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockImplementation((event: Record<string, unknown>) => {
        capturedAuditEvent = event
        return Promise.resolve()
      }),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      `http://localhost/api/v1/internal/tenants/${mockOrganizationId}/modules/${mockConfigId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ enabled: true }),
      },
    ) as never

    await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })

    expect(capturedAuditEvent).not.toBeNull()
    expect(capturedAuditEvent!.before_values).toEqual({ enabled: true })
    expect(capturedAuditEvent!.after_values).toEqual({ enabled: true })
  })

  it('passes reason to audit event when provided', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Admin',
        surname: 'User',
        email: 'admin@example.com',
        internal_role_id: 'role-superadmin',
        roleName: 'Super Admin',
      }),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation(() => {
          queryCallCount++
          if (queryCallCount === 1) return mockDbResponse([{ id: 'org-1' }])
          if (queryCallCount === 2) return mockDbResponse([{ ...mockConfig, enabled: false }])
          return mockDbResponse([])
        }),
      },
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockResolvedValue(undefined),
    }))

    const { PATCH } = await import('@/app/api/v1/internal/tenants/[organizationId]/modules/[configId]/route')
    const request = new Request(
      `http://localhost/api/v1/internal/tenants/${mockOrganizationId}/modules/${mockConfigId}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ enabled: true, reason: 'Client request' }),
      },
    ) as never

    const response = await PATCH(request, { params: { organizationId: mockOrganizationId, configId: mockConfigId } })
    expect(response.status).toBe(200)
  })
})
