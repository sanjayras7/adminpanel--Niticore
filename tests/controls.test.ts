import { Op } from 'sequelize'
import { checkRateLimit, resetRateLimiter } from '@/lib/rate-limiter'

beforeEach(() => {
  resetRateLimiter()
})

describe('Control CRUD route handlers', () => {
  const mockDate = new Date('2026-01-01T00:00:00Z')
  const mockControl = {
    id: 'ctrl-1',
    control_code: 'CC-1',
    title: 'Access Control',
    description: 'Manages access control',
    created_at: mockDate,
    updated_at: mockDate,
    deleted_at: null,
    toJSON: function () { return { ...this } },
  }

  const mockVersion = {
    id: 'ver-1',
    control_id: 'ctrl-1',
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

  const mockStep = {
    id: 'step-1',
    control_version_id: 'ver-1',
    step_code: 'AC-1',
    title: 'Access Control Step',
    description: null,
    category_id: null,
    sort_order: 0,
    created_at: mockDate,
    updated_at: mockDate,
    get: function (key: string) { return (this as Record<string, unknown>)[key] },
    save: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    toJSON: function () { return { ...this, get: undefined, save: undefined, destroy: undefined, toJSON: undefined } },
  }

  describe('GET /api/v1/internal/controls (list)', () => {
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

      jest.doMock('@/lib/models', () => ({
        Control: {},
        ControlVersion: {},
        ControlImplementationStep: {},
        ControlStepCategory: {},
        ControlEvidenceType: {},
      }))

      const { GET } = await import('@/app/api/v1/internal/controls/route')
      const request = new Request('http://localhost/api/v1/internal/controls') as never
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('unauthorized')
    })

    it('returns paginated list of controls', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Control: {
          findAndCountAll: jest.fn().mockResolvedValue({
            count: 1,
            rows: [{
              ...mockControl,
              toJSON: function () { return { ...this } },
            }],
          }),
        },
        ControlVersion: {},
      }))

      const { GET } = await import('@/app/api/v1/internal/controls/route')
      const request = new Request('http://localhost/api/v1/internal/controls?page=1&page_size=20') as never
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.total).toBe(1)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].control_code).toBe('CC-1')
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
        Control: {
          findAndCountAll: jest.fn().mockImplementation((opts) => {
            capturedWhere = opts.where as Record<string, unknown>
            return Promise.resolve({ count: 0, rows: [] })
          }),
        },
        ControlVersion: {},
      }))

      const { GET } = await import('@/app/api/v1/internal/controls/route')
      const request = new Request('http://localhost/api/v1/internal/controls?search=Access') as never
      await GET(request)

      const orFilter = capturedWhere[Op.or as unknown as string] as Record<string, unknown>[]
      expect(orFilter).toBeDefined()
      expect(orFilter).toHaveLength(2)
    })
  })

  describe('POST /api/v1/internal/controls (create)', () => {
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

      const { POST } = await import('@/app/api/v1/internal/controls/route')
      const request = new Request('http://localhost/api/v1/internal/controls', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'auditor-1' },
        body: JSON.stringify({ control_code: 'CC-1', title: 'Access Control' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toBe('forbidden')
    })

    it('returns 400 when control_code is missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/route')
      const request = new Request('http://localhost/api/v1/internal/controls', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('returns 400 when title is missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/route')
      const request = new Request('http://localhost/api/v1/internal/controls', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ control_code: 'CC-1' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('returns 409 for duplicate control_code', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Control: {
          findOne: jest.fn().mockResolvedValue(mockControl),
        },
        ControlVersion: {},
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/route')
      const request = new Request('http://localhost/api/v1/internal/controls', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ control_code: 'CC-1', title: 'Access Control' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('conflict')
    })

    it('creates a control successfully', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Control: {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockControl),
        },
        ControlVersion: {},
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/route')
      const request = new Request('http://localhost/api/v1/internal/controls', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ control_code: 'CC-1', title: 'Access Control', description: 'Manages access control' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.control_code).toBe('CC-1')
    })
  })

  describe('GET /api/v1/internal/controls/[id] (get single)', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('returns 404 for non-existent control', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Control: {
          findByPk: jest.fn().mockResolvedValue(null),
        },
        ControlVersion: {},
      }))

      const { GET } = await import('@/app/api/v1/internal/controls/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/controls/nonexistent') as never
      const response = await GET(request, { params: { id: 'nonexistent' } })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toBe('not_found')
    })

    it('returns control with version summary', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Control: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockControl,
            toJSON: function () {
              return {
                id: this.id,
                control_code: this.control_code,
                title: this.title,
                description: this.description,
                created_at: this.created_at,
                updated_at: this.updated_at,
                deleted_at: this.deleted_at,
                versions: [mockVersion],
              }
            },
          }),
        },
        ControlVersion: {},
      }))

      const { GET } = await import('@/app/api/v1/internal/controls/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1') as never
      const response = await GET(request, { params: { id: 'ctrl-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.control_code).toBe('CC-1')
      expect(body.data.version_count).toBe(1)
    })
  })

  describe('PUT /api/v1/internal/controls/[id] (update)', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('updates control metadata in-place', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      let saved = false
      jest.doMock('@/lib/models', () => ({
        Control: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockControl,
            save: jest.fn().mockImplementation(function (this: Record<string, unknown>) {
              saved = true
              return Promise.resolve(this)
            }),
            toJSON: function (this: Record<string, unknown>) { return { ...this, save: undefined, toJSON: undefined } },
          }),
        },
        ControlVersion: {},
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { PUT } = await import('@/app/api/v1/internal/controls/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ title: 'Updated Control' }),
      }) as never

      const response = await PUT(request, { params: { id: 'ctrl-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(saved).toBe(true)
    })
  })

  describe('DELETE /api/v1/internal/controls/[id]', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('returns 409 when control has active versions', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const activeVersion = { ...mockVersion, status: 'active' }
      jest.doMock('@/lib/models', () => ({
        Control: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockControl,
            toJSON: function () {
              return {
                ...this,
                versions: [activeVersion],
              }
            },
            destroy: jest.fn(),
          }),
        },
        ControlVersion: {},
      }))

      const { DELETE } = await import('@/app/api/v1/internal/controls/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1', {
        method: 'DELETE',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'ctrl-1' } })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('conflict')
    })

    it('soft-deletes control with only draft versions', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      let destroyed = false
      jest.doMock('@/lib/models', () => ({
        Control: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockControl,
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
        ControlVersion: {},
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { DELETE } = await import('@/app/api/v1/internal/controls/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1', {
        method: 'DELETE',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'ctrl-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(destroyed).toBe(true)
      expect(body.data.id).toBe('ctrl-1')
    })
  })

  describe('Control Versioning', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('creates a version under a control', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        Control: {
          findByPk: jest.fn().mockResolvedValue(mockControl),
        },
        ControlVersion: {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockVersion),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/[id]/versions/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ version_label: '1.0' }),
      }) as never

      const response = await POST(request, { params: { id: 'ctrl-1' } })
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
        Control: {
          findByPk: jest.fn().mockResolvedValue(mockControl),
        },
        ControlVersion: {
          findOne: jest.fn().mockResolvedValue(mockVersion),
        },
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/[id]/versions/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ version_label: '1.0' }),
      }) as never

      const response = await POST(request, { params: { id: 'ctrl-1' } })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('conflict')
    })

    it('publishes a draft version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const stepWithStep = {
        ...mockStep,
        get: function (key: string) {
          return (this as Record<string, unknown>)[key]
        },
        toJSON: function () {
          return {
            ...this,
            get: undefined,
            save: undefined,
            destroy: undefined,
            toJSON: undefined,
          }
        },
      }

      const draftVersion = {
        ...mockVersion,
        status: 'draft',
        get: function (key: string) {
          if (key === 'implementationSteps') return [stepWithStep]
          return (this as Record<string, unknown>)[key]
        },
        save: jest.fn().mockImplementation(function (this: Record<string, unknown>) {
          this.status = 'active'
          return Promise.resolve(this)
        }),
        toJSON: function (this: Record<string, unknown>) { return { ...this, get: undefined, save: undefined, destroy: undefined, toJSON: undefined, status: 'active' } },
      }

      jest.doMock('@/lib/models', () => ({
        ControlVersion: {
          findByPk: jest.fn().mockResolvedValue(draftVersion),
        },
        ControlImplementationStep: {},
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/publish/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { id: 'ctrl-1', vid: 'ver-1' } })
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
        ControlVersion: {
          findByPk: jest.fn().mockResolvedValue(activeVersion),
        },
        ControlImplementationStep: {},
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/publish/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { id: 'ctrl-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('invalid_action')
    })
  })

  describe('Implementation Step CRUD', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('creates a step in a draft version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        ControlVersion: {
          findByPk: jest.fn().mockResolvedValue({ ...mockVersion, status: 'draft' }),
        },
        ControlImplementationStep: {
          create: jest.fn().mockResolvedValue(mockStep),
        },
        ControlStepCategory: {},
        ControlEvidenceType: {},
      }))

      jest.doMock('@/lib/control-versioning', () => ({
        ensureDraftVersion: jest.fn().mockImplementation((v: { status: string }) => {
          if (v.status !== 'draft') {
            const newV = { ...v, id: 'new-ver-cloned', status: 'draft' }
            return Promise.resolve({ version: newV, wasCloned: true, stepIdMap: new Map() })
          }
          return Promise.resolve({ version: v, wasCloned: false })
        }),
        cloneVersion: jest.fn(),
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/implementation-steps/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1/implementation-steps', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ step_code: 'AC-1', title: 'Access Control Step' }),
      }) as never

      const response = await POST(request, { params: { id: 'ctrl-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.step_code).toBe('AC-1')
    })

    it('returns 400 when step_code or title missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/implementation-steps/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1/implementation-steps', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request, { params: { id: 'ctrl-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('deletes a step from a draft version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        ControlVersion: {
          findByPk: jest.fn().mockResolvedValue({ ...mockVersion, status: 'draft' }),
        },
        ControlImplementationStep: {
          findOne: jest.fn().mockResolvedValue(mockStep),
        },
        ControlStepCategory: {},
        ControlEvidenceType: {},
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { DELETE } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/implementation-steps/[sid]/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1/implementation-steps/step-1', {
        method: 'DELETE',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'ctrl-1', vid: 'ver-1', sid: 'step-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.id).toBe('step-1')
    })

    it('blocks step deletion from active version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      jest.doMock('@/lib/models', () => ({
        ControlVersion: {
          findByPk: jest.fn().mockResolvedValue({ ...mockVersion, status: 'active' }),
        },
      }))

      const { DELETE } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/implementation-steps/[sid]/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1/implementation-steps/step-1', {
        method: 'DELETE',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'ctrl-1', vid: 'ver-1', sid: 'step-1' } })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('invalid_action')
    })
  })

  describe('Auto-clone on edit (versioning rule)', () => {
    beforeEach(() => {
      jest.resetModules()
    })

    it('mutates draft version in-place (no clone)', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const draftVersion = {
        ...mockVersion,
        status: 'draft',
        save: jest.fn().mockResolvedValue(undefined),
        toJSON: function () { return { ...this, save: undefined, toJSON: undefined } },
      }

      jest.doMock('@/lib/models', () => ({
        ControlVersion: {
          findByPk: jest.fn().mockResolvedValue(draftVersion),
        },
        ControlImplementationStep: {
          create: jest.fn().mockResolvedValue(mockStep),
        },
        ControlStepCategory: {},
        ControlEvidenceType: {},
      }))

      jest.doMock('@/lib/control-versioning', () => ({
        ensureDraftVersion: jest.fn().mockImplementation((v: { status: string }) => {
          if (v.status !== 'draft') {
            const newV = { ...v, id: 'new-ver-cloned', status: 'draft' }
            return Promise.resolve({ version: newV, wasCloned: true, stepIdMap: new Map() })
          }
          return Promise.resolve({ version: v, wasCloned: false })
        }),
        cloneVersion: jest.fn(),
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/implementation-steps/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1/implementation-steps', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ step_code: 'AC-2', title: 'Step 2' }),
      }) as never

      const response = await POST(request, { params: { id: 'ctrl-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.step_code).toBe('AC-1')
    })

    it('clones version and creates step on active version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const activeVersion = { ...mockVersion, status: 'active', save: jest.fn() }
      const clonedVersion = { ...mockVersion, id: 'new-ver-cloned', status: 'draft', save: jest.fn() }

      jest.doMock('@/lib/models', () => ({
        ControlVersion: {
          findByPk: jest.fn().mockResolvedValue(activeVersion),
        },
        ControlImplementationStep: {
          create: jest.fn().mockResolvedValue(mockStep),
        },
        ControlStepCategory: {},
        ControlEvidenceType: {},
      }))

      jest.doMock('@/lib/control-versioning', () => ({
        ensureDraftVersion: jest.fn().mockResolvedValue({
          version: clonedVersion,
          wasCloned: true,
          stepIdMap: new Map(),
        }),
        cloneVersion: jest.fn(),
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/implementation-steps/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1/implementation-steps', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ step_code: 'AC-2', title: 'Step 2' }),
      }) as never

      const response = await POST(request, { params: { id: 'ctrl-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(body.cloned_version_id).toBe('new-ver-cloned')
    })

    it('updates step on active version returns cloned_version_id', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const activeVersion = { ...mockVersion, status: 'active', save: jest.fn() }
      const clonedVersion = { ...mockVersion, id: 'new-ver-cloned', status: 'draft', save: jest.fn() }
      const stepIdMap = new Map<string, string>()
      stepIdMap.set('step-1', 'step-1-cloned')

      jest.doMock('@/lib/models', () => ({
        ControlVersion: {
          findByPk: jest.fn().mockResolvedValue(activeVersion),
        },
        ControlImplementationStep: {
          findOne: jest.fn().mockResolvedValue(mockStep),
          findByPk: jest.fn().mockImplementation((id: string) => {
            if (id === 'step-1-cloned') return Promise.resolve({ ...mockStep, id: 'step-1-cloned', save: jest.fn(), toJSON: function () { return { ...this, save: undefined, toJSON: undefined } } })
            return Promise.resolve(null)
          }),
        },
        ControlStepCategory: {},
        ControlEvidenceType: {},
      }))

      jest.doMock('@/lib/control-versioning', () => ({
        ensureDraftVersion: jest.fn().mockResolvedValue({
          version: clonedVersion,
          wasCloned: true,
          stepIdMap,
        }),
        cloneVersion: jest.fn(),
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { PUT } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/implementation-steps/[sid]/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1/implementation-steps/step-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ title: 'Updated Step' }),
      }) as never

      const response = await PUT(request, { params: { id: 'ctrl-1', vid: 'ver-1', sid: 'step-1' } })
      const body = await response.json()

      expect(body.cloned_version_id).toBe('new-ver-cloned')
      expect(body.data).toBeDefined()
    })

    it('returns 201 with cloned_from_version_id on version metadata update for active version', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      const activeVersion = { ...mockVersion, status: 'active', save: jest.fn() }
      const newDraftVersion = {
        ...mockVersion,
        id: 'new-ver-2',
        status: 'draft',
        save: jest.fn(),
        toJSON: function () { return { ...this, save: undefined, toJSON: undefined, cloned_from_version_id: 'ver-1' } },
      }

      jest.doMock('@/lib/models', () => ({
        ControlVersion: {
          findByPk: jest.fn().mockResolvedValue(activeVersion),
        },
        ControlImplementationStep: {},
        ControlEvidenceType: {},
      }))

      jest.doMock('@/lib/control-versioning', () => ({
        cloneVersion: jest.fn().mockResolvedValue({ newVersion: newDraftVersion, stepIdMap: new Map() }),
        ensureDraftVersion: jest.fn(),
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { PUT } = await import('@/app/api/v1/internal/controls/[id]/versions/[vid]/route')
      const request = new Request('http://localhost/api/v1/internal/controls/ctrl-1/versions/ver-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ description: 'Updated description' }),
      }) as never

      const response = await PUT(request, { params: { id: 'ctrl-1', vid: 'ver-1' } })
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.cloned_from_version_id).toBe('ver-1')
    })
  })

  describe('Rate limiting for control endpoints', () => {
    it('allows first request', () => {
      const result = checkRateLimit('controls:ip:127.0.0.1')
      expect(result.allowed).toBe(true)
      expect(result.retryAfterMs).toBe(0)
    })

    it('blocks after max attempts', () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit('controls:ip:10.0.0.1')
      }
      const result = checkRateLimit('controls:ip:10.0.0.1')
      expect(result.allowed).toBe(false)
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })

    it('tracks different IPs independently', () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit('controls:ip:10.0.0.1')
      }
      expect(checkRateLimit('controls:ip:10.0.0.1').allowed).toBe(false)
      expect(checkRateLimit('controls:ip:10.0.0.2').allowed).toBe(true)
    })
  })
})
