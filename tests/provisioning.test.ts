import { resetRateLimiter } from '@/lib/rate-limiter'

const mockDate = new Date('2026-06-01T00:00:00Z')

const mockLog = {
  id: 'log-1',
  organization_id: 'org-1',
  tenant_hash: 'tenant-hash-abc',
  template_version_id: 'tmpl-ver-1',
  status: 'success',
  failed_table: null,
  error_message: null,
  started_at: mockDate,
  completed_at: mockDate,
  created_at: mockDate,
  toJSON: function () { return { ...this } },
}

const mockFailedLog = {
  id: 'log-2',
  organization_id: 'org-2',
  tenant_hash: 'tenant-hash-def',
  template_version_id: 'tmpl-ver-1',
  status: 'failed',
  failed_table: 'users',
  error_message: 'Column "email" already exists',
  started_at: mockDate,
  completed_at: mockDate,
  created_at: mockDate,
  toJSON: function () { return { ...this } },
}

const mockInProgressLog = {
  id: 'log-3',
  organization_id: 'org-3',
  tenant_hash: 'tenant-hash-ghi',
  template_version_id: 'tmpl-ver-1',
  status: 'in_progress',
  failed_table: null,
  error_message: null,
  started_at: mockDate,
  completed_at: null,
  created_at: mockDate,
  toJSON: function () { return { ...this } },
}

const mockDetails = [
  {
    id: 'det-1',
    provisioning_log_id: 'log-1',
    schema_name: 'tenant_hash_abc',
    table_name: 'users',
    status: 'created',
    error_message: null,
    rows_created: 10,
    started_at: mockDate,
    completed_at: mockDate,
    toJSON: function () { return { ...this } },
  },
  {
    id: 'det-2',
    provisioning_log_id: 'log-1',
    schema_name: 'tenant_hash_abc',
    table_name: 'roles',
    status: 'created',
    error_message: null,
    rows_created: 5,
    started_at: mockDate,
    completed_at: mockDate,
    toJSON: function () { return { ...this } },
  },
]

beforeEach(() => {
  resetRateLimiter()
})

describe('GET /api/v1/internal/organizations/:orgId/provisioning', () => {
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

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/provisioning') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns null when no provisioning log exists for the org', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-unknown/provisioning') as never
    const response = await GET(request, { params: { orgId: 'org-unknown' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toBeNull()
  })

  it('returns provisioning log for successful provisioning', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockResolvedValue(mockLog),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/provisioning') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.id).toBe('log-1')
    expect(body.status).toBe('success')
    expect(body.tenant_hash).toBe('tenant-hash-abc')
    expect(body.failed_table).toBeNull()
    expect(body.error_message).toBeNull()
  })

  it('returns provisioning log with failed status and error detail', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockResolvedValue(mockFailedLog),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-2/provisioning') as never
    const response = await GET(request, { params: { orgId: 'org-2' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('failed')
    expect(body.failed_table).toBe('users')
    expect(body.error_message).toBe('Column "email" already exists')
  })

  it('returns provisioning log with in_progress status', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockResolvedValue(mockInProgressLog),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-3/provisioning') as never
    const response = await GET(request, { params: { orgId: 'org-3' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('in_progress')
    expect(body.completed_at).toBeNull()
  })

  it('queries by organization_id and orders by created_at DESC', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    let capturedWhere: Record<string, unknown> = {}
    let capturedOrder: unknown[] = []
    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockImplementation((opts) => {
          capturedWhere = opts.where as Record<string, unknown>
          capturedOrder = opts.order as unknown[]
          return Promise.resolve(mockLog)
        }),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/provisioning') as never
    await GET(request, { params: { orgId: 'org-1' } })

    expect(capturedWhere.organization_id).toBe('org-1')
    expect(capturedOrder).toEqual([['created_at', 'DESC']])
  })

  it('returns 500 on database error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/provisioning') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})

describe('GET /api/v1/internal/organizations/:orgId/provisioning/details', () => {
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

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/details/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/provisioning/details') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns empty array when no provisioning log exists for the org', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/details/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-unknown/provisioning/details') as never
    const response = await GET(request, { params: { orgId: 'org-unknown' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([])
  })

  it('returns all detail rows for a successful provisioning', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockResolvedValue(mockLog),
      },
      TenantProvisioningDetail: {
        findAll: jest.fn().mockResolvedValue(mockDetails),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/details/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/provisioning/details') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].table_name).toBe('users')
    expect(body[0].status).toBe('created')
    expect(body[0].rows_created).toBe(10)
    expect(body[1].table_name).toBe('roles')
  })

  it('returns empty array when log exists but no detail records', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockResolvedValue(mockLog),
      },
      TenantProvisioningDetail: {
        findAll: jest.fn().mockResolvedValue([]),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/details/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/provisioning/details') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([])
  })

  it('queries details by provisioning_log_id ordered by started_at ASC', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    let capturedWhere: Record<string, unknown> = {}
    let capturedOrder: unknown[] = []
    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockResolvedValue(mockLog),
      },
      TenantProvisioningDetail: {
        findAll: jest.fn().mockImplementation((opts) => {
          capturedWhere = opts.where as Record<string, unknown>
          capturedOrder = opts.order as unknown[]
          return Promise.resolve(mockDetails)
        }),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/details/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/provisioning/details') as never
    await GET(request, { params: { orgId: 'org-1' } })

    expect(capturedWhere.provisioning_log_id).toBe('log-1')
    expect(capturedOrder).toEqual([['started_at', 'ASC']])
  })

  it('returns 500 on database error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantProvisioningLog: {
        findOne: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/provisioning/details/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/provisioning/details') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})
