jest.mock('@/lib/sequelize', () => ({
  sequelize: {
    define: jest.fn().mockReturnValue({}),
    query: jest.fn(),
    transaction: jest.fn(),
  },
}))

jest.mock('@/lib/audit', () => ({
  writeAuditEvent: jest.fn().mockResolvedValue(undefined),
}))

const mockDate = new Date('2026-06-01T00:00:00Z')

const mockOrg = {
  id: 'org-1',
  name: 'Acme Corp',
  domain: 'acme.com',
  tenant_hash: 'abc123def',
  status: 'active',
  created_at: mockDate,
  updated_at: mockDate,
  deleted_at: null,
}

const mockOrgNoDomain = {
  ...mockOrg,
  id: 'org-2',
  domain: null,
}

const mockOrgIntegrated = {
  ...mockOrg,
  id: 'org-3',
  domain: 'integrated.com',
}

const mockAdmins = [
  {
    id: 'u1', name: 'Alice', email: 'alice@acme.com', role: 'Admin', status: 'active', last_login_at: mockDate,
    toJSON: function () { return { ...this } },
  },
  {
    id: 'u2', name: 'Bob', email: 'bob@acme.com', role: 'Editor', status: 'active', last_login_at: null,
    toJSON: function () { return { ...this } },
  },
]

const mockLogEntry = {
  id: 'log-1',
  organization_id: 'org-1',
  status: 'success',
  error_message: null,
  started_at: mockDate,
  completed_at: mockDate,
  created_at: mockDate,
  details: [
    {
      table_name: 'users',
      status: 'created',
      error_message: null,
      rows_created: 10,
      started_at: mockDate,
      completed_at: mockDate,
    },
  ],
  toJSON: function () { return { ...this } },
}

const mockIntegIntent = {
  id: 'int-1',
  organization_id: 'org-3',
  domain: 'integrated.com',
  sso_required: true,
  sso_provider: 'Okta',
  notes: null,
  created_by: null,
  created_at: mockDate,
  updated_at: mockDate,
}

const mockAuditEvent = {
  id: 'evt-1',
  organization_id: 'org-1',
  action: 'provisioning.error',
  target_type: 'provisioning',
  target_id: 'log-1',
  after_values: { error_message: 'Table creation failed' },
  before_values: null,
  created_at: mockDate,
  toJSON: function () { return { ...this } },
}

describe('GET /api/v1/internal/tenants/:orgId/customer-admins', () => {
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
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({}))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/customer-admins/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/customer-admins') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('forbidden')
  })

  it('returns 403 when role lacks permission', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Finance/Admin' }),
      requirePermission: jest.fn().mockImplementation(() => {
        throw new (class extends Error {
          statusCode = 403
          constructor() {
            super('Insufficient permissions')
          }
        })()
      }),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({}))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/customer-admins/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/customer-admins') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 404 when tenant not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/customer-admins/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/nonexistent/customer-admins') as never
    const response = await GET(request, { params: { orgId: 'nonexistent' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns list of customer admins when found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
    }))

    jest.doMock('@/lib/queries/tenant', () => ({
      getCustomerAdmins: jest.fn().mockResolvedValue([
        { id: 'u1', name: 'Alice', email: 'alice@acme.com', role: 'Admin', status: 'active', lastLoginAt: '2026-06-01T00:00:00.000Z' },
        { id: 'u2', name: 'Bob', email: 'bob@acme.com', role: 'Editor', status: 'active', lastLoginAt: null },
      ]),
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/customer-admins/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/customer-admins') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.admins).toHaveLength(2)
    expect(body.admins[0].name).toBe('Alice')
    expect(body.admins[0].role).toBe('Admin')
    expect(body.admins[1].name).toBe('Bob')
    expect(body.admins[1].lastLoginAt).toBeNull()
  })

  it('returns empty admins list when no admins exist', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
    }))

    jest.doMock('@/lib/queries/tenant', () => ({
      getCustomerAdmins: jest.fn().mockResolvedValue([]),
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/customer-admins/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/customer-admins') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.admins).toEqual([])
  })

  it('returns 500 on database error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/customer-admins/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/customer-admins') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})

describe('GET /api/v1/internal/tenants/:orgId/logs', () => {
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
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/logs/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/logs') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('forbidden')
  })

  it('returns 403 when role lacks permission', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Finance/Admin' }),
      requirePermission: jest.fn().mockImplementation(() => {
        throw new (class extends Error {
          statusCode = 403
          constructor() {
            super('Insufficient permissions')
          }
        })()
      }),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/logs/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/logs') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 404 when tenant not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
      TenantProvisioningLog: {},
      TenantProvisioningDetail: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/logs/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/nonexistent/logs') as never
    const response = await GET(request, { params: { orgId: 'nonexistent' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns logs with details when found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
      TenantProvisioningLog: {
        findAll: jest.fn().mockResolvedValue([mockLogEntry]),
      },
      TenantProvisioningDetail: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/logs/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/logs') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.logs).toHaveLength(1)
    expect(body.logs[0].status).toBe('success')
    expect(body.logs[0].details).toHaveLength(1)
    expect(body.logs[0].details[0].table_name).toBe('users')
    expect(body.logs[0].details[0].rows_created).toBe(10)
  })

  it('returns empty logs array when no provisioning activity', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
      TenantProvisioningLog: {
        findAll: jest.fn().mockResolvedValue([]),
      },
      TenantProvisioningDetail: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/logs/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/logs') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.logs).toEqual([])
  })

  it('returns 500 on database error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      },
      TenantProvisioningLog: {},
      TenantProvisioningDetail: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/logs/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/logs') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})

describe('GET /api/v1/internal/tenants/:orgId/integration-health', () => {
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
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/integration-health/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/integration-health') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('forbidden')
  })

  it('returns 403 when role lacks permission', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Finance/Admin' }),
      requirePermission: jest.fn().mockImplementation(() => {
        throw new (class extends Error {
          statusCode = 403
          constructor() {
            super('Insufficient permissions')
          }
        })()
      }),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/integration-health/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/integration-health') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 404 when tenant not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
      OrganizationIntegrationIntent: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/integration-health/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/nonexistent/integration-health') as never
    const response = await GET(request, { params: { orgId: 'nonexistent' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns healthy when domain verified and SSO configured', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrgIntegrated),
      },
      OrganizationIntegrationIntent: {
        findOne: jest.fn().mockResolvedValue(mockIntegIntent),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/integration-health/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-3/integration-health') as never
    const response = await GET(request, { params: { orgId: 'org-3' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.domain_verified).toBe(true)
    expect(body.sso_configured).toBe(true)
    expect(body.sso_type).toBe('Okta')
    expect(body.overall_status).toBe('healthy')
  })

  it('returns degraded when only domain verified', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
      OrganizationIntegrationIntent: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/integration-health/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/integration-health') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.domain_verified).toBe(true)
    expect(body.sso_configured).toBe(false)
    expect(body.sso_type).toBeNull()
    expect(body.overall_status).toBe('degraded')
  })

  it('returns unconfigured when nothing is set up', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrgNoDomain),
      },
      OrganizationIntegrationIntent: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/integration-health/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-2/integration-health') as never
    const response = await GET(request, { params: { orgId: 'org-2' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.domain_verified).toBe(false)
    expect(body.sso_configured).toBe(false)
    expect(body.overall_status).toBe('unconfigured')
  })

  it('returns 500 on database error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      },
      OrganizationIntegrationIntent: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/integration-health/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/integration-health') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})

describe('GET /api/v1/internal/tenants/:orgId/usage-errors', () => {
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
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/usage-errors/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/usage-errors') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('forbidden')
  })

  it('returns 403 when role lacks permission', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Finance/Admin' }),
      requirePermission: jest.fn().mockImplementation(() => {
        throw new (class extends Error {
          statusCode = 403
          constructor() {
            super('Insufficient permissions')
          }
        })()
      }),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/usage-errors/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/usage-errors') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 404 when tenant not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
      InternalAuditEvent: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/usage-errors/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/nonexistent/usage-errors') as never
    const response = await GET(request, { params: { orgId: 'nonexistent' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns zero values for a new tenant with no data', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
      InternalAuditEvent: {
        findAll: jest.fn().mockResolvedValue([]),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/usage-errors/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/usage-errors') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.total_users).toBe(0)
    expect(body.active_users_30d).toBe(0)
    expect(body.api_calls_30d).toBe(0)
    expect(body.storage_used_bytes).toBeNull()
    expect(body.recent_errors).toEqual([])
    expect(body.error_count_total_30d).toBe(0)
    expect(body.last_error_at).toBeNull()
  })

  it('returns grouped error summaries when errors exist', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Support' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
      InternalAuditEvent: {
        findAll: jest.fn().mockResolvedValue([
          { ...mockAuditEvent, id: 'evt-1', action: 'provisioning.error', after_values: { error_message: 'Table creation failed' }, created_at: mockDate },
          { ...mockAuditEvent, id: 'evt-2', action: 'provisioning.error', after_values: { error_message: 'Table creation failed' }, created_at: mockDate },
          { ...mockAuditEvent, id: 'evt-3', action: 'sync.error', after_values: { error_message: 'Sync timeout' }, created_at: mockDate },
        ]),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/usage-errors/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/usage-errors') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.recent_errors).toHaveLength(2)
    expect(body.error_count_total_30d).toBe(3)
    expect(body.last_error_at).toBe('2026-06-01T00:00:00.000Z')

    const provisioningErr = body.recent_errors.find((e: { error_type: string }) => e.error_type === 'provisioning.error')
    expect(provisioningErr).toBeDefined()
    expect(provisioningErr.count).toBe(2)

    const syncErr = body.recent_errors.find((e: { error_type: string }) => e.error_type === 'sync.error')
    expect(syncErr).toBeDefined()
    expect(syncErr.count).toBe(1)
  })

  it('returns 500 on database error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requirePermission: jest.fn(),
      ACTION_PERMISSIONS: {},
      SENSITIVE_ACTIONS: new Set(),
    }))

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      },
      InternalAuditEvent: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[orgId]/usage-errors/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/usage-errors') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})
