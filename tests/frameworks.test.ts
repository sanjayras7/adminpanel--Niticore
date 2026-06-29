import { checkRateLimit, resetRateLimiter } from '@/lib/rate-limiter'

beforeEach(() => {
  resetRateLimiter()
})

describe('Auth helper - getAuthUser / requireMutationAuth', () => {
  const mockInternalRoles = [
    { id: 'role-superadmin', name: 'Super Admin', is_active: true },
    { id: 'role-auditor', name: 'Read-only Auditor', is_active: true },
  ]

  beforeEach(() => {
    jest.resetModules()
  })

  it('throws AuthError when x-internal-user-id header is missing', async () => {
    const { getAuthUser, AuthError } = await import('@/lib/auth')
    const request = new Request('http://localhost', {
      headers: {},
    }) as never

    await expect(getAuthUser(request)).rejects.toThrow(AuthError)
    await expect(getAuthUser(request)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('throws AuthError when user is not found', async () => {
    jest.doMock('@/lib/models', () => ({
      InternalUser: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
      InternalRole: {},
    }))

    const { getAuthUser, AuthError } = await import('@/lib/auth')
    const request = new Request('http://localhost', {
      headers: { 'x-internal-user-id': 'nonexistent-user' },
    }) as never

    await expect(getAuthUser(request)).rejects.toThrow(AuthError)
  })

  it('returns AuthUser for valid user', async () => {
    jest.doMock('@/lib/models', () => ({
      InternalUser: {
        findByPk: jest.fn().mockResolvedValue({
          id: 'user-1',
          name: 'Test',
          surname: 'User',
          email: 'test@example.com',
          internal_role_id: 'role-superadmin',
          get: (key: string) => key === 'role' ? { id: 'role-superadmin', name: 'Super Admin' } : null,
        }),
      },
      InternalRole: {},
    }))

    const { getAuthUser } = await import('@/lib/auth')
    const request = new Request('http://localhost', {
      headers: { 'x-internal-user-id': 'user-1' },
    }) as never

    const user = await getAuthUser(request)
    expect(user.id).toBe('user-1')
    expect(user.roleName).toBe('Super Admin')
  })

  it('requireMutationAuth rejects Read-only Auditor', async () => {
    const { requireMutationAuth, AuthError } = await import('@/lib/auth')

    const auditorUser = {
      id: 'user-2',
      name: 'Audit',
      surname: 'User',
      email: 'auditor@example.com',
      internal_role_id: 'role-auditor',
      roleName: 'Read-only Auditor',
    }

    expect(() => requireMutationAuth(auditorUser)).toThrow(AuthError)
    try {
      requireMutationAuth(auditorUser)
    } catch (e: unknown) {
      expect((e as { statusCode: number }).statusCode).toBe(403)
    }
  })

  it('requireMutationAuth allows Super Admin', async () => {
    const { requireMutationAuth } = await import('@/lib/auth')

    const superAdminUser = {
      id: 'user-1',
      name: 'Test',
      surname: 'User',
      email: 'test@example.com',
      internal_role_id: 'role-superadmin',
      roleName: 'Super Admin',
    }

    expect(() => requireMutationAuth(superAdminUser)).not.toThrow()
  })
})

describe('Audit helper - writeAuditEvent', () => {
  it('writes audit event without throwing', async () => {
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
        action: 'framework.create',
        target_type: 'framework',
        target_id: 'fw-1',
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
        action: 'framework.create',
        target_type: 'framework',
        target_id: 'fw-1',
      }),
    ).resolves.toBeUndefined()
  })
})

describe('Framework CRUD route handlers', () => {
  const mockDate = new Date('2026-01-01T00:00:00Z')
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

  const mockVersion = {
    id: 'ver-1',
    framework_id: 'fw-1',
    version_label: '1.0',
    description: null,
    status: 'draft',
    effective_date: null,
    created_at: mockDate,
    updated_at: mockDate,
    deleted_at: null,
    get: function (key: string) { return (this as Record<string, unknown>)[key] },
    save: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    toJSON: function () { return { ...this, get: undefined, save: undefined, destroy: undefined, toJSON: undefined } },
  }

  const mockSection = {
    id: 'sec-1',
    framework_version_id: 'ver-1',
    parent_section_id: null,
    section_code: 'AC-1',
    title: 'Access Control',
    description: null,
    sort_order: 0,
    created_at: mockDate,
    updated_at: mockDate,
    get: function (key: string) { return (this as Record<string, unknown>)[key] },
    save: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    toJSON: function () { return { ...this, get: undefined, save: undefined, destroy: undefined, toJSON: undefined } },
  }

  const mockClause = {
    id: 'cl-1',
    framework_section_id: 'sec-1',
    clause_code: 'AC-1.a',
    clause_text: 'Access control policy must exist',
    sort_order: 0,
    created_at: mockDate,
    updated_at: mockDate,
    get: function (_key: string) { return undefined },
    save: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    toJSON: function () { return { ...this, get: undefined, save: undefined, destroy: undefined, toJSON: undefined } },
  }

  describe('GET /api/v1/internal/frameworks (list)', () => {
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

      const { GET } = await import('@/app/api/v1/internal/frameworks/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks') as never
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('unauthorized')
    })

    it('returns paginated list of frameworks', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Framework: {
          findAndCountAll: jest.fn().mockResolvedValue({
            count: 1,
            rows: [{
              ...mockFramework,
              toJSON: function () { return { ...this } },
            }],
          }),
        },
        FrameworkVersion: {},
      }))

      const { GET } = await import('@/app/api/v1/internal/frameworks/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks?page=1&page_size=20') as never
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.total).toBe(1)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].name).toBe('NIST CSF')
      expect(body.page).toBe(1)
      expect(body.page_size).toBe(20)
    })

    it('handles search parameter', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      let capturedWhere: Record<string, unknown> = {}
      jest.doMock('@/lib/models', () => ({
        Framework: {
          findAndCountAll: jest.fn().mockImplementation((opts) => {
            capturedWhere = opts.where as Record<string, unknown>
            return Promise.resolve({ count: 0, rows: [] })
          }),
        },
        FrameworkVersion: {},
      }))

      const { GET } = await import('@/app/api/v1/internal/frameworks/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks?search=test') as never
      await GET(request)

      expect(capturedWhere.name).toBeDefined()
    })
  })

  describe('POST /api/v1/internal/frameworks (create)', () => {
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

      const { POST } = await import('@/app/api/v1/internal/frameworks/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'auditor-1' },
        body: JSON.stringify({ name: 'Test Framework' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toBe('forbidden')
    })

    it('returns 400 when name is missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('creates a framework successfully', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Framework: {
          create: jest.fn().mockResolvedValue(mockFramework),
        },
        FrameworkVersion: {},
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ name: 'NIST CSF', description: 'Cybersecurity framework' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.name).toBe('NIST CSF')
    })
  })

  describe('GET /api/v1/internal/frameworks/[id] (get single)', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('returns 404 for non-existent framework', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Framework: {
          findByPk: jest.fn().mockResolvedValue(null),
        },
        FrameworkVersion: {},
      }))

      const { GET } = await import('@/app/api/v1/internal/frameworks/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/nonexistent') as never
      const response = await GET(request, { params: { id: 'nonexistent' } })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toBe('not_found')
    })

    it('returns framework with version summary', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Framework: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockFramework,
            toJSON: function () {
              return {
                id: this.id,
                name: this.name,
                description: this.description,
                classification_id: this.classification_id,
                created_at: this.created_at,
                updated_at: this.updated_at,
                deleted_at: this.deleted_at,
                versions: [mockVersion],
              }
            },
          }),
        },
        FrameworkVersion: {},
      }))

      const { GET } = await import('@/app/api/v1/internal/frameworks/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1') as never
      const response = await GET(request, { params: { id: 'fw-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.name).toBe('NIST CSF')
      expect(body.data.version_count).toBe(1)
    })
  })

  describe('PUT /api/v1/internal/frameworks/[id] (update)', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('updates framework metadata in-place', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      let saved = false
      const updateMock = { ...mockFramework, name: 'Updated Framework' }
      jest.doMock('@/lib/models', () => ({
        Framework: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockFramework,
            save: jest.fn().mockImplementation(function (this: Record<string, unknown>) {
              saved = true
              return Promise.resolve(this)
            }),
            toJSON: function (this: Record<string, unknown>) { return { ...this, save: undefined, toJSON: undefined } },
          }),
        },
        FrameworkVersion: {},
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { PUT } = await import('@/app/api/v1/internal/frameworks/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ name: 'Updated Framework' }),
      }) as never

      const response = await PUT(request, { params: { id: 'fw-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(saved).toBe(true)
    })
  })

  describe('DELETE /api/v1/internal/frameworks/[id]', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('returns 409 when framework has active versions', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const activeVersion = { ...mockVersion, status: 'active' }
      jest.doMock('@/lib/models', () => ({
        Framework: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockFramework,
            toJSON: function () {
              return {
                ...this,
                versions: [activeVersion],
              }
            },
            destroy: jest.fn(),
          }),
        },
        FrameworkVersion: {},
      }))

      const { DELETE } = await import('@/app/api/v1/internal/frameworks/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1', {
        method: 'DELETE',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'fw-1' } })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('conflict')
    })

    it('soft-deletes framework with only draft versions', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      let destroyed = false
      jest.doMock('@/lib/models', () => ({
        Framework: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockFramework,
            toJSON: function () {
              return {
                ...this,
                versions: [{ ...mockVersion, status: 'draft' }],
              }
            },
            destroy: jest.fn().mockImplementation(() => {
              destroyed = true
              return Promise.resolve()
            }),
          }),
        },
        FrameworkVersion: {},
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { DELETE } = await import('@/app/api/v1/internal/frameworks/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1', {
        method: 'DELETE',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'fw-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(destroyed).toBe(true)
      expect(body.data.id).toBe('fw-1')
    })
  })

  describe('Framework Versioning', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('creates a version under a framework', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Framework: {
          findByPk: jest.fn().mockResolvedValue(mockFramework),
        },
        FrameworkVersion: {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockVersion),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/[id]/versions/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ version_label: '1.0' }),
      }) as never

      const response = await POST(request, { params: { id: 'fw-1' } })
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.version_label).toBe('1.0')
    })

    it('returns 409 for duplicate version label', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Framework: {
          findByPk: jest.fn().mockResolvedValue(mockFramework),
        },
        FrameworkVersion: {
          findOne: jest.fn().mockResolvedValue(mockVersion),
        },
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/[id]/versions/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ version_label: '1.0' }),
      }) as never

      const response = await POST(request, { params: { id: 'fw-1' } })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('conflict')
    })

    it('publishes a draft version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const sectionWithClauses = {
        ...mockSection,
        get: function (key: string) {
          if (key === 'clauses') return [mockClause]
          return (this as Record<string, unknown>)[key]
        },
        toJSON: function () {
          return {
            ...this,
            get: undefined,
            save: undefined,
            destroy: undefined,
            toJSON: undefined,
            clauses: [mockClause],
          }
        },
      }

      const draftVersion = {
        ...mockVersion,
        status: 'draft',
        get: function (key: string) {
          if (key === 'sections') return [sectionWithClauses]
          return (this as Record<string, unknown>)[key]
        },
        save: jest.fn().mockImplementation(function (this: Record<string, unknown>) {
          this.status = 'active'
          return Promise.resolve(this)
        }),
        toJSON: function (this: Record<string, unknown>) { return { ...this, get: undefined, save: undefined, destroy: undefined, toJSON: undefined, status: 'active' } },
      }

      jest.doMock('@/lib/models', () => ({
        FrameworkVersion: {
          findByPk: jest.fn().mockResolvedValue(draftVersion),
        },
        FrameworkSection: {},
        FrameworkClause: {},
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/[id]/versions/[vid]/publish/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions/ver-1/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { id: 'fw-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
    })

    it('prevents publishing an active version again', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const activeVersion = {
        ...mockVersion,
        status: 'active',
        get: function (key: string) { return (this as Record<string, unknown>)[key] },
      }

      jest.doMock('@/lib/models', () => ({
        FrameworkVersion: {
          findByPk: jest.fn().mockResolvedValue(activeVersion),
        },
        FrameworkSection: {},
        FrameworkClause: {},
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/[id]/versions/[vid]/publish/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions/ver-1/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { id: 'fw-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('invalid_action')
    })
  })

  describe('Section CRUD', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('creates a section in a draft version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        FrameworkVersion: {
          findByPk: jest.fn().mockResolvedValue({ ...mockVersion, status: 'draft' }),
        },
        FrameworkSection: {
          create: jest.fn().mockResolvedValue(mockSection),
        },
        FrameworkClause: {},
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/[id]/versions/[vid]/sections/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions/ver-1/sections', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ section_code: 'AC-1', title: 'Access Control' }),
      }) as never

      const response = await POST(request, { params: { id: 'fw-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.section_code).toBe('AC-1')
    })

    it('returns 400 when section_code or title missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/[id]/versions/[vid]/sections/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions/ver-1/sections', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { id: 'fw-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('deletes a section from a draft version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        FrameworkVersion: {
          findByPk: jest.fn().mockResolvedValue({ ...mockVersion, status: 'draft' }),
        },
        FrameworkSection: {
          findOne: jest.fn().mockResolvedValue(mockSection),
          findAll: jest.fn().mockResolvedValue([]),
        },
        FrameworkClause: {
          findAll: jest.fn().mockResolvedValue([]),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { DELETE } = await import('@/app/api/v1/internal/frameworks/[id]/versions/[vid]/sections/[sid]/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions/ver-1/sections/sec-1', {
        method: 'DELETE',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'fw-1', vid: 'ver-1', sid: 'sec-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.id).toBe('sec-1')
    })

    it('blocks section deletion from active version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        FrameworkVersion: {
          findByPk: jest.fn().mockResolvedValue({ ...mockVersion, status: 'active' }),
        },
      }))

      const { DELETE } = await import('@/app/api/v1/internal/frameworks/[id]/versions/[vid]/sections/[sid]/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions/ver-1/sections/sec-1', {
        method: 'DELETE',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'fw-1', vid: 'ver-1', sid: 'sec-1' } })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('invalid_action')
    })
  })

  describe('Clause CRUD', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('creates a clause under a section', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        FrameworkVersion: {
          findByPk: jest.fn().mockResolvedValue({ ...mockVersion, status: 'draft' }),
        },
        FrameworkSection: {
          findByPk: jest.fn().mockResolvedValue(mockSection),
        },
        FrameworkClause: {
          create: jest.fn().mockResolvedValue(mockClause),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/[id]/versions/[vid]/sections/[sid]/clauses/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions/ver-1/sections/sec-1/clauses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ clause_code: 'AC-1.a', clause_text: 'Access control policy must exist' }),
      }) as never

      const response = await POST(request, { params: { id: 'fw-1', vid: 'ver-1', sid: 'sec-1' } })
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.clause_code).toBe('AC-1.a')
    })

    it('returns 400 when clause_code or clause_text missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const { POST } = await import('@/app/api/v1/internal/frameworks/[id]/versions/[vid]/sections/[sid]/clauses/route')
      const request = new Request('http://localhost/api/v1/internal/frameworks/fw-1/versions/ver-1/sections/sec-1/clauses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { id: 'fw-1', vid: 'ver-1', sid: 'sec-1' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })
  })

  describe('Rate limiting for framework endpoints', () => {
    it('allows first request', () => {
      const result = checkRateLimit('frameworks:ip:127.0.0.1')
      expect(result.allowed).toBe(true)
      expect(result.retryAfterMs).toBe(0)
    })

    it('blocks after max attempts', () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit('frameworks:ip:10.0.0.1')
      }
      const result = checkRateLimit('frameworks:ip:10.0.0.1')
      expect(result.allowed).toBe(false)
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })

    it('tracks different IPs independently', () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit('frameworks:ip:10.0.0.1')
      }
      expect(checkRateLimit('frameworks:ip:10.0.0.1').allowed).toBe(false)
      expect(checkRateLimit('frameworks:ip:10.0.0.2').allowed).toBe(true)
    })
  })
})
