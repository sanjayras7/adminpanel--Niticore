import { v4 as uuidv4 } from 'uuid'

describe('Tenant Framework Config API - GET /api/v1/internal/organizations/:orgId/frameworks', () => {
  const mockDate = new Date('2026-01-01T00:00:00Z')
  const mockConfig = {
    id: 'config-1',
    organization_id: 'org-1',
    framework_id: 'fw-1',
    framework_version_id: 'ver-1',
    is_active: true,
    assigned_by: 'user-1',
    assigned_at: mockDate,
    deactivated_at: null,
    deactivated_by: null,
    created_at: mockDate,
    updated_at: mockDate,
    toJSON: function () {
      return {
        id: this.id,
        organization_id: this.organization_id,
        framework_id: this.framework_id,
        framework_version_id: this.framework_version_id,
        is_active: this.is_active,
        assigned_by: this.assigned_by,
        assigned_at: this.assigned_at,
        deactivated_at: this.deactivated_at,
        deactivated_by: this.deactivated_by,
        created_at: this.created_at,
        updated_at: this.updated_at,
        framework: { id: 'fw-1', name: 'NIST CSF', classification: 'cybersecurity' },
        frameworkVersion: { id: 'ver-1', version_label: '1.1', status: 'active', effective_date: '2024-01-01' },
      }
    },
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
      requireMutationAuth: jest.fn(),
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns empty list when no configs exist', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findAll: jest.fn().mockResolvedValue([]),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([])
  })

  it('returns active configs for a tenant', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findAll: jest.fn().mockResolvedValue([mockConfig]),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks') as never
    const response = await GET(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('config-1')
    expect(body.data[0].framework).toBeDefined()
    expect(body.data[0].framework_version).toBeDefined()
  })
})

describe('Tenant Framework Config API - POST /api/v1/internal/organizations/:orgId/frameworks', () => {
  const mockDate = new Date('2026-01-01T00:00:00Z')
  const mockConfig = {
    id: 'config-1',
    organization_id: 'org-1',
    framework_id: 'fw-1',
    framework_version_id: 'ver-1',
    is_active: true,
    assigned_by: 'user-1',
    assigned_at: mockDate,
    deactivated_at: null,
    deactivated_by: null,
    created_at: mockDate,
    updated_at: mockDate,
    toJSON: function () {
      return { ...this }
    },
  }

  const mockFramework = {
    id: 'fw-1',
    name: 'NIST CSF',
    description: 'Cybersecurity framework',
    classification_id: null,
    created_at: mockDate,
    updated_at: mockDate,
    deleted_at: null,
    toJSON: function () { return { ...this } },
  }

  const mockFrameworkVersion = {
    id: 'ver-1',
    framework_id: 'fw-1',
    version_label: '1.1',
    description: null,
    status: 'active',
    effective_date: '2024-01-01',
    created_at: mockDate,
    updated_at: mockDate,
    deleted_at: null,
    toJSON: function () { return { ...this } },
  }

  beforeEach(() => {
    jest.resetModules()
  })

  it('returns 403 for Read-only Auditor', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
      requireMutationAuth: jest.fn().mockImplementation(() => {
        throw new (class extends Error {
          statusCode = 403
          constructor() {
            super('Read-only Auditor cannot perform mutations')
          }
        })()
      }),
    }))

    const { POST } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'auditor-1' },
      body: JSON.stringify({ framework_id: 'fw-1', framework_version_id: 'ver-1' }),
    }) as never

    const response = await POST(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 400 when framework_id is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as never

    const response = await POST(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 404 when framework version not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: { findOne: jest.fn(), create: jest.fn() },
      FrameworkVersion: { findByPk: jest.fn().mockResolvedValue(null) },
      Framework: {},
    }))

    const { POST } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_id: 'fw-1', framework_version_id: 'nonexistent' }),
    }) as never

    const response = await POST(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 400 when assigning a non-active version', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: { findOne: jest.fn(), create: jest.fn() },
      FrameworkVersion: {
        findByPk: jest.fn().mockResolvedValue({
          id: 'ver-draft',
          framework_id: 'fw-1',
          status: 'draft',
          toJSON: function () { return { ...this } },
        }),
      },
      Framework: {},
    }))

    const { POST } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_id: 'fw-1', framework_version_id: 'ver-draft' }),
    }) as never

    const response = await POST(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_version')
  })

  it('returns 400 when version does not belong to framework', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: { findOne: jest.fn(), create: jest.fn() },
      FrameworkVersion: {
        findByPk: jest.fn().mockResolvedValue({
          id: 'ver-other',
          framework_id: 'fw-other',
          status: 'active',
          toJSON: function () { return { ...this } },
        }),
      },
      Framework: {},
    }))

    const { POST } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_id: 'fw-1', framework_version_id: 'ver-other' }),
    }) as never

    const response = await POST(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('version_mismatch')
  })

  it('returns 409 when tenant already has active config for same framework+version', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findOne: jest.fn().mockResolvedValue(mockConfig),
        create: jest.fn(),
      },
      FrameworkVersion: {
        findByPk: jest.fn().mockResolvedValue(mockFrameworkVersion),
      },
      Framework: {
        findByPk: jest.fn().mockResolvedValue(mockFramework),
      },
    }))

    const { POST } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_id: 'fw-1', framework_version_id: 'ver-1' }),
    }) as never

    const response = await POST(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('conflict')
  })

  it('creates a config successfully with audit event', async () => {
    let auditCalled = false

    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockConfig),
      },
      FrameworkVersion: {
        findByPk: jest.fn().mockResolvedValue(mockFrameworkVersion),
      },
      Framework: {
        findByPk: jest.fn().mockResolvedValue(mockFramework),
      },
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockImplementation(() => {
        auditCalled = true
        return Promise.resolve()
      }),
    }))

    const { POST } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_id: 'fw-1', framework_version_id: 'ver-1' }),
    }) as never

    const response = await POST(request, { params: { orgId: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.framework_version_id).toBe('ver-1')
    expect(auditCalled).toBe(true)
  })
})

describe('Tenant Framework Config API - PUT /api/v1/internal/organizations/:orgId/frameworks/:configId', () => {
  const mockDate = new Date('2026-01-01T00:00:00Z')
  const mockConfig = {
    id: 'config-1',
    organization_id: 'org-1',
    framework_id: 'fw-1',
    framework_version_id: 'ver-1',
    is_active: true,
    assigned_by: 'user-1',
    assigned_at: mockDate,
    deactivated_at: null,
    deactivated_by: null,
    created_at: mockDate,
    updated_at: mockDate,
    get: function (_key: string) { return undefined },
    save: jest.fn().mockResolvedValue(undefined),
    toJSON: function () { return { ...this, get: undefined, save: undefined, toJSON: undefined } },
  }

  beforeEach(() => {
    jest.resetModules()
  })

  it('returns 403 for Read-only Auditor', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
      requireMutationAuth: jest.fn().mockImplementation(() => {
        throw new (class extends Error {
          statusCode = 403
          constructor() {
            super('Read-only Auditor cannot perform mutations')
          }
        })()
      }),
    }))

    const { PUT } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'auditor-1' },
      body: JSON.stringify({ framework_version_id: 'ver-2' }),
    }) as never

    const response = await PUT(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 404 when config not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    const { PUT } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/nonexistent', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_version_id: 'ver-2' }),
    }) as never

    const response = await PUT(request, { params: { orgId: 'org-1', configId: 'nonexistent' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 400 when framework_version_id is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    const { PUT } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({}),
    }) as never

    const response = await PUT(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 400 when new version is not active', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue(mockConfig),
      },
      FrameworkVersion: {
        findByPk: jest.fn().mockResolvedValue({
          id: 'ver-draft',
          framework_id: 'fw-1',
          status: 'draft',
        }),
      },
      Framework: {},
    }))

    const { PUT } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_version_id: 'ver-draft' }),
    }) as never

    const response = await PUT(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_version')
  })

  it('returns 400 when version belongs to different framework', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue(mockConfig),
      },
      FrameworkVersion: {
        findByPk: jest.fn().mockResolvedValue({
          id: 'ver-other',
          framework_id: 'fw-other',
          status: 'active',
        }),
      },
      Framework: {},
    }))

    const { PUT } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_version_id: 'ver-other' }),
    }) as never

    const response = await PUT(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('version_mismatch')
  })

  it('returns 409 when updating a deactivated config', async () => {
    const deactivatedConfig = {
      ...mockConfig,
      is_active: false,
      deactivated_at: mockDate,
      deactivated_by: 'user-1',
    }

    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue(deactivatedConfig),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    const { PUT } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_version_id: 'ver-2' }),
    }) as never

    const response = await PUT(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('invalid_action')
  })

  it('updates config successfully with audit event', async () => {
    let auditCalled = false
    let saved = false

    const updatableConfig = {
      ...mockConfig,
      framework_version_id: 'ver-1',
      save: jest.fn().mockImplementation(function (this: Record<string, unknown>) {
        saved = true
        this.framework_version_id = 'ver-2'
        return Promise.resolve()
      }),
    }

    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue(updatableConfig),
      },
      FrameworkVersion: {
        findByPk: jest.fn().mockResolvedValue({
          id: 'ver-2',
          framework_id: 'fw-1',
          status: 'active',
        }),
      },
      Framework: {},
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockImplementation(() => {
        auditCalled = true
        return Promise.resolve()
      }),
    }))

    const { PUT } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ framework_version_id: 'ver-2' }),
    }) as never

    const response = await PUT(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(saved).toBe(true)
    expect(auditCalled).toBe(true)
  })
})

describe('Tenant Framework Config API - DELETE /api/v1/internal/organizations/:orgId/frameworks/:configId', () => {
  const mockDate = new Date('2026-01-01T00:00:00Z')
  const mockConfig = {
    id: 'config-1',
    organization_id: 'org-1',
    framework_id: 'fw-1',
    framework_version_id: 'ver-1',
    is_active: true,
    assigned_by: 'user-1',
    assigned_at: mockDate,
    deactivated_at: null,
    deactivated_by: null,
    created_at: mockDate,
    updated_at: mockDate,
    save: jest.fn().mockResolvedValue(undefined),
    toJSON: function () { return { ...this, save: undefined, toJSON: undefined } },
  }

  beforeEach(() => {
    jest.resetModules()
  })

  it('returns 403 for Read-only Auditor', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
      requireMutationAuth: jest.fn().mockImplementation(() => {
        throw new (class extends Error {
          statusCode = 403
          constructor() {
            super('Read-only Auditor cannot perform mutations')
          }
        })()
      }),
    }))

    const { DELETE } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1', {
      method: 'DELETE',
      headers: { 'x-internal-user-id': 'auditor-1' },
    }) as never

    const response = await DELETE(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 404 when config not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    const { DELETE } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/nonexistent', {
      method: 'DELETE',
      headers: { 'x-internal-user-id': 'user-1' },
    }) as never

    const response = await DELETE(request, { params: { orgId: 'org-1', configId: 'nonexistent' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 409 when deactivating an already-inactive config', async () => {
    const inactiveConfig = {
      ...mockConfig,
      is_active: false,
      deactivated_at: mockDate,
      deactivated_by: 'user-1',
    }

    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue(inactiveConfig),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    const { DELETE } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1', {
      method: 'DELETE',
      headers: { 'x-internal-user-id': 'user-1' },
    }) as never

    const response = await DELETE(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('invalid_action')
  })

  it('deactivates config successfully with audit event', async () => {
    let auditCalled = false
    let saved = false

    const activeConfig = {
      ...mockConfig,
      is_active: true,
      save: jest.fn().mockImplementation(function (this: Record<string, unknown>) {
        saved = true
        this.is_active = false
        this.deactivated_at = new Date()
        this.deactivated_by = 'user-1'
        return Promise.resolve()
      }),
    }

    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue(activeConfig),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockImplementation(() => {
        auditCalled = true
        return Promise.resolve()
      }),
    }))

    const { DELETE } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1', {
      method: 'DELETE',
      headers: { 'x-internal-user-id': 'user-1' },
    }) as never

    const response = await DELETE(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(saved).toBe(true)
    expect(body.data.is_active).toBe(false)
    expect(auditCalled).toBe(true)
  })
})

describe('Tenant Framework Config API - GET /api/v1/internal/organizations/:orgId/frameworks/:configId/history', () => {
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
      requireMutationAuth: jest.fn(),
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/history/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1/history') as never
    const response = await GET(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns 404 when config does not exist', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/history/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/nonexistent/history') as never
    const response = await GET(request, { params: { orgId: 'org-1', configId: 'nonexistent' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns history events sorted by most recent', async () => {
    const mockDate = new Date('2026-01-01T00:00:00Z')

    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue({
          id: 'config-1',
          organization_id: 'org-1',
          framework_id: 'fw-1',
          framework_version_id: 'ver-1',
          is_active: true,
          assigned_by: 'user-1',
          assigned_at: mockDate,
          deactivated_at: null,
          deactivated_by: null,
          created_at: mockDate,
          updated_at: mockDate,
        }),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    const mockEvents = [
      {
        id: 'event-2',
        action: 'tenant_framework_config.update',
        actor_internal_user_id: 'user-1',
        actor_role: 'Implementation Manager',
        before_values: { framework_version_id: 'ver-1', is_active: true },
        after_values: { framework_version_id: 'ver-2', is_active: true },
        reason: null,
        created_at: '2026-01-15T11:00:00Z',
      },
      {
        id: 'event-1',
        action: 'tenant_framework_config.create',
        actor_internal_user_id: 'user-1',
        actor_role: 'Super Admin',
        before_values: null,
        after_values: { framework_id: 'fw-1', framework_version_id: 'ver-1', is_active: true },
        reason: null,
        created_at: '2026-01-15T10:30:00Z',
      },
    ]

    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockResolvedValue([mockEvents, {}]),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/history/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1/history') as never
    const response = await GET(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].action).toBe('tenant_framework_config.update')
    expect(body.data[1].action).toBe('tenant_framework_config.create')
  })

  it('returns empty array when no history exists', async () => {
    const mockDate = new Date('2026-01-01T00:00:00Z')

    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      TenantFrameworkConfig: {
        findByPk: jest.fn().mockResolvedValue({
          id: 'config-1',
          organization_id: 'org-1',
          framework_id: 'fw-1',
          framework_version_id: 'ver-1',
          is_active: true,
          assigned_by: 'user-1',
          assigned_at: mockDate,
          deactivated_at: null,
          deactivated_by: null,
          created_at: mockDate,
          updated_at: mockDate,
        }),
      },
      Framework: {},
      FrameworkVersion: {},
    }))

    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockResolvedValue([[], {}]),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/organizations/[orgId]/frameworks/[configId]/history/route')
    const request = new Request('http://localhost/api/v1/internal/organizations/org-1/frameworks/config-1/history') as never
    const response = await GET(request, { params: { orgId: 'org-1', configId: 'config-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([])
  })
})

describe('Audit helper - writeAuditEvent for tenant_framework_config', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('writes audit event for config create without throwing', async () => {
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockResolvedValue([[], {}]),
      },
    }))

    const { writeAuditEvent } = await import('@/lib/audit')

    await expect(
      writeAuditEvent({
        actor_internal_user_id: 'user-1',
        actor_role: 'Super Admin',
        action: 'tenant_framework_config.create',
        target_type: 'tenant_framework_config',
        target_id: 'config-1',
        organization_id: 'org-1',
        after_values: { framework_id: 'fw-1', framework_version_id: 'ver-1', is_active: true },
      }),
    ).resolves.toBeUndefined()
  })

  it('does not throw on DB error (fail-open)', async () => {
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockRejectedValue(new Error('DB error')),
      },
    }))

    const { writeAuditEvent } = await import('@/lib/audit')

    await expect(
      writeAuditEvent({
        actor_internal_user_id: 'user-1',
        actor_role: 'Super Admin',
        action: 'tenant_framework_config.create',
        target_type: 'tenant_framework_config',
        target_id: 'config-1',
        organization_id: 'org-1',
      }),
    ).resolves.toBeUndefined()
  })
})
