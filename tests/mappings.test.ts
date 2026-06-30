import { UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize'

const mockDate = new Date('2026-01-01T00:00:00Z')

const mockFrameworkMapping = {
  id: 'cfm-1',
  control_id: 'ctrl-1',
  framework_clause_id: 'fc-1',
  created_at: mockDate,
  updated_at: mockDate,
  toJSON: function () { return { ...this } },
}

const mockRiskMapping = {
  id: 'crm-1',
  control_id: 'ctrl-1',
  risk_id: 'risk-1',
  created_at: mockDate,
  updated_at: mockDate,
  toJSON: function () { return { ...this } },
}

describe('Control-Framework Mappings', () => {
  describe('GET /api/v1/internal/control-framework-mappings (list)', () => {
    beforeEach(() => { jest.resetModules() })

    it('returns 401 when not authenticated', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockRejectedValue(Object.assign(new Error('unauthorized'), { statusCode: 401 })),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({ ControlFrameworkMapping: {} }))

      const { GET } = await import('@/app/api/v1/internal/control-framework-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings') as never
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('unauthorized')
    })

    it('returns paginated list of mappings', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: {
          findAndCountAll: jest.fn().mockResolvedValue({ count: 1, rows: [{ ...mockFrameworkMapping, toJSON: function () { return { ...this } } }] }),
        },
      }))

      const { GET } = await import('@/app/api/v1/internal/control-framework-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings') as never
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.total).toBe(1)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].control_id).toBe('ctrl-1')
    })

    it('filters by control_id', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      let capturedWhere: Record<string, unknown> = {}
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: {
          findAndCountAll: jest.fn().mockImplementation((opts) => {
            capturedWhere = opts.where as Record<string, unknown>
            return Promise.resolve({ count: 0, rows: [] })
          }),
        },
      }))

      const { GET } = await import('@/app/api/v1/internal/control-framework-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings?control_id=ctrl-1') as never
      await GET(request)

      expect(capturedWhere.control_id).toBe('ctrl-1')
    })
  })

  describe('POST /api/v1/internal/control-framework-mappings (create)', () => {
    beforeEach(() => { jest.resetModules() })

    it('returns 403 for Read-only Auditor', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
        requireMutationAuth: jest.fn().mockImplementation(() => { throw Object.assign(new Error('Read-only Auditor cannot perform mutations'), { statusCode: 403 }) }),
      }))
      jest.doMock('@/lib/models', () => ({ ControlFrameworkMapping: {} }))

      const { POST } = await import('@/app/api/v1/internal/control-framework-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ control_id: 'ctrl-1', framework_clause_id: 'fc-1' }),
      }) as never

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 when control_id is missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({ ControlFrameworkMapping: {} }))

      const { POST } = await import('@/app/api/v1/internal/control-framework-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ framework_clause_id: 'fc-1' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()
      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('returns 400 when framework_clause_id is missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({ ControlFrameworkMapping: {} }))

      const { POST } = await import('@/app/api/v1/internal/control-framework-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ control_id: 'ctrl-1' }),
      }) as never

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('returns 409 on duplicate mapping', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: {
          create: jest.fn().mockRejectedValue(new UniqueConstraintError({ errors: [] })),
        },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: jest.fn().mockResolvedValue(undefined) }))

      const { POST } = await import('@/app/api/v1/internal/control-framework-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ control_id: 'ctrl-1', framework_clause_id: 'fc-1' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()
      expect(response.status).toBe(409)
      expect(body.error).toBe('conflict')
    })

    it('returns 400 on non-existent FK reference', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: {
          create: jest.fn().mockRejectedValue(new ForeignKeyConstraintError({ fields: [], table: '', index: '' })),
        },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: jest.fn().mockResolvedValue(undefined) }))

      const { POST } = await import('@/app/api/v1/internal/control-framework-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ control_id: 'bad-ctrl', framework_clause_id: 'bad-fc' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()
      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('creates a mapping successfully and audits it', async () => {
      const writeAuditEvent = jest.fn().mockResolvedValue(undefined)

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: {
          create: jest.fn().mockResolvedValue(mockFrameworkMapping),
        },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent }))

      const { POST } = await import('@/app/api/v1/internal/control-framework-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ control_id: 'ctrl-1', framework_clause_id: 'fc-1' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.control_id).toBe('ctrl-1')
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'mapping.create', target_type: 'control_framework_mapping' }),
      )
    })
  })

  describe('GET /api/v1/internal/control-framework-mappings/[id] (get single)', () => {
    beforeEach(() => { jest.resetModules() })

    it('returns 404 for non-existent mapping', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: { findByPk: jest.fn().mockResolvedValue(null) },
      }))

      const { GET } = await import('@/app/api/v1/internal/control-framework-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings/nonexistent') as never
      const response = await GET(request, { params: { id: 'nonexistent' } })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toBe('not_found')
    })

    it('returns mapping by id', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: { findByPk: jest.fn().mockResolvedValue(mockFrameworkMapping) },
      }))

      const { GET } = await import('@/app/api/v1/internal/control-framework-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings/cfm-1') as never
      const response = await GET(request, { params: { id: 'cfm-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.control_id).toBe('ctrl-1')
    })
  })

  describe('PUT /api/v1/internal/control-framework-mappings/[id] (update)', () => {
    beforeEach(() => { jest.resetModules() })

    it('returns 403 for Read-only Auditor', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
        requireMutationAuth: jest.fn().mockImplementation(() => { throw Object.assign(new Error('Read-only Auditor cannot perform mutations'), { statusCode: 403 }) }),
      }))
      jest.doMock('@/lib/models', () => ({ ControlFrameworkMapping: {} }))

      const { PUT } = await import('@/app/api/v1/internal/control-framework-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings/cfm-1', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ control_id: 'ctrl-2' }),
      }) as never

      const response = await PUT(request, { params: { id: 'cfm-1' } })
      expect(response.status).toBe(403)
    })

    it('updates mapping and audits it', async () => {
      const writeAuditEvent = jest.fn().mockResolvedValue(undefined)
      const saveMock = jest.fn().mockResolvedValue(undefined)

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockFrameworkMapping,
            save: saveMock,
            toJSON: function () { return { ...this, save: undefined, toJSON: undefined } },
          }),
        },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent }))

      const { PUT } = await import('@/app/api/v1/internal/control-framework-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings/cfm-1', {
        method: 'PUT', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ framework_clause_id: 'fc-2' }),
      }) as never

      const response = await PUT(request, { params: { id: 'cfm-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(saveMock).toHaveBeenCalled()
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'mapping.update', target_type: 'control_framework_mapping' }),
      )
    })

    it('returns 409 on duplicate after update', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockFrameworkMapping,
            save: jest.fn().mockRejectedValue(new UniqueConstraintError({ errors: [] })),
            toJSON: function () { return { ...this, save: undefined, toJSON: undefined } },
          }),
        },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: jest.fn().mockResolvedValue(undefined) }))

      const { PUT } = await import('@/app/api/v1/internal/control-framework-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings/cfm-1', {
        method: 'PUT', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ control_id: 'ctrl-1', framework_clause_id: 'fc-1' }),
      }) as never

      const response = await PUT(request, { params: { id: 'cfm-1' } })
      expect(response.status).toBe(409)
    })
  })

  describe('DELETE /api/v1/internal/control-framework-mappings/[id]', () => {
    beforeEach(() => { jest.resetModules() })

    it('returns 403 for Read-only Auditor', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
        requireMutationAuth: jest.fn().mockImplementation(() => { throw Object.assign(new Error('Read-only Auditor cannot perform mutations'), { statusCode: 403 }) }),
      }))
      jest.doMock('@/lib/models', () => ({ ControlFrameworkMapping: {} }))

      const { DELETE } = await import('@/app/api/v1/internal/control-framework-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings/cfm-1', { method: 'DELETE' }) as never
      const response = await DELETE(request, { params: { id: 'cfm-1' } })
      expect(response.status).toBe(403)
    })

    it('deletes mapping and audits it', async () => {
      const writeAuditEvent = jest.fn().mockResolvedValue(undefined)
      const destroyMock = jest.fn().mockResolvedValue(undefined)

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockFrameworkMapping,
            destroy: destroyMock,
          }),
        },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent }))

      const { DELETE } = await import('@/app/api/v1/internal/control-framework-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings/cfm-1', {
        method: 'DELETE', headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'cfm-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(destroyMock).toHaveBeenCalled()
      expect(body.data.id).toBe('cfm-1')
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'mapping.delete', target_type: 'control_framework_mapping' }),
      )
    })

    it('returns 404 when mapping not found', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlFrameworkMapping: { findByPk: jest.fn().mockResolvedValue(null) },
      }))

      const { DELETE } = await import('@/app/api/v1/internal/control-framework-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-framework-mappings/nonexistent', {
        method: 'DELETE', headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'nonexistent' } })
      expect(response.status).toBe(404)
    })
  })
})

describe('Control-Risk Mappings', () => {
  describe('GET /api/v1/internal/control-risk-mappings (list)', () => {
    beforeEach(() => { jest.resetModules() })

    it('returns 401 when not authenticated', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockRejectedValue(Object.assign(new Error('unauthorized'), { statusCode: 401 })),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({ ControlRiskMapping: {} }))

      const { GET } = await import('@/app/api/v1/internal/control-risk-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings') as never
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('unauthorized')
    })

    it('returns paginated list of risk mappings', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlRiskMapping: {
          findAndCountAll: jest.fn().mockResolvedValue({ count: 1, rows: [{ ...mockRiskMapping, toJSON: function () { return { ...this } } }] }),
        },
      }))

      const { GET } = await import('@/app/api/v1/internal/control-risk-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings') as never
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.total).toBe(1)
      expect(body.data[0].risk_id).toBe('risk-1')
    })

    it('filters by risk_id', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))

      let capturedWhere: Record<string, unknown> = {}
      jest.doMock('@/lib/models', () => ({
        ControlRiskMapping: {
          findAndCountAll: jest.fn().mockImplementation((opts) => {
            capturedWhere = opts.where as Record<string, unknown>
            return Promise.resolve({ count: 0, rows: [] })
          }),
        },
      }))

      const { GET } = await import('@/app/api/v1/internal/control-risk-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings?risk_id=risk-1') as never
      await GET(request)

      expect(capturedWhere.risk_id).toBe('risk-1')
    })
  })

  describe('POST /api/v1/internal/control-risk-mappings (create)', () => {
    beforeEach(() => { jest.resetModules() })

    it('returns 403 for Read-only Auditor', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
        requireMutationAuth: jest.fn().mockImplementation(() => { throw Object.assign(new Error('Read-only Auditor cannot perform mutations'), { statusCode: 403 }) }),
      }))
      jest.doMock('@/lib/models', () => ({ ControlRiskMapping: {} }))

      const { POST } = await import('@/app/api/v1/internal/control-risk-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ control_id: 'ctrl-1', risk_id: 'risk-1' }),
      }) as never

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('returns 400 when required fields missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({ ControlRiskMapping: {} }))

      const { POST } = await import('@/app/api/v1/internal/control-risk-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }) as never

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('returns 409 on duplicate risk mapping', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlRiskMapping: {
          create: jest.fn().mockRejectedValue(new UniqueConstraintError({ errors: [] })),
        },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent: jest.fn().mockResolvedValue(undefined) }))

      const { POST } = await import('@/app/api/v1/internal/control-risk-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ control_id: 'ctrl-1', risk_id: 'risk-1' }),
      }) as never

      const response = await POST(request)
      expect(response.status).toBe(409)
    })

    it('creates a risk mapping successfully and audits it', async () => {
      const writeAuditEvent = jest.fn().mockResolvedValue(undefined)

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlRiskMapping: { create: jest.fn().mockResolvedValue(mockRiskMapping) },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent }))

      const { POST } = await import('@/app/api/v1/internal/control-risk-mappings/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ control_id: 'ctrl-1', risk_id: 'risk-1' }),
      }) as never

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.data.risk_id).toBe('risk-1')
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'mapping.create', target_type: 'control_risk_mapping' }),
      )
    })
  })

  describe('GET /api/v1/internal/control-risk-mappings/[id] (get single)', () => {
    beforeEach(() => { jest.resetModules() })

    it('returns 404 for non-existent risk mapping', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlRiskMapping: { findByPk: jest.fn().mockResolvedValue(null) },
      }))

      const { GET } = await import('@/app/api/v1/internal/control-risk-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings/nonexistent') as never
      const response = await GET(request, { params: { id: 'nonexistent' } })
      expect(response.status).toBe(404)
    })

    it('returns risk mapping by id', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlRiskMapping: { findByPk: jest.fn().mockResolvedValue(mockRiskMapping) },
      }))

      const { GET } = await import('@/app/api/v1/internal/control-risk-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings/crm-1') as never
      const response = await GET(request, { params: { id: 'crm-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.risk_id).toBe('risk-1')
    })
  })

  describe('PUT /api/v1/internal/control-risk-mappings/[id] (update)', () => {
    beforeEach(() => { jest.resetModules() })

    it('updates risk mapping and audits it', async () => {
      const writeAuditEvent = jest.fn().mockResolvedValue(undefined)
      const saveMock = jest.fn().mockResolvedValue(undefined)

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlRiskMapping: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockRiskMapping,
            save: saveMock,
            toJSON: function () { return { ...this, save: undefined, toJSON: undefined } },
          }),
        },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent }))

      const { PUT } = await import('@/app/api/v1/internal/control-risk-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings/crm-1', {
        method: 'PUT', headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ risk_id: 'risk-2' }),
      }) as never

      const response = await PUT(request, { params: { id: 'crm-1' } })
      expect(response.status).toBe(200)
      expect(saveMock).toHaveBeenCalled()
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'mapping.update', target_type: 'control_risk_mapping' }),
      )
    })
  })

  describe('DELETE /api/v1/internal/control-risk-mappings/[id]', () => {
    beforeEach(() => { jest.resetModules() })

    it('returns 403 for Read-only Auditor', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
        requireMutationAuth: jest.fn().mockImplementation(() => { throw Object.assign(new Error('Read-only Auditor cannot perform mutations'), { statusCode: 403 }) }),
      }))
      jest.doMock('@/lib/models', () => ({ ControlRiskMapping: {} }))

      const { DELETE } = await import('@/app/api/v1/internal/control-risk-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings/crm-1', { method: 'DELETE' }) as never
      const response = await DELETE(request, { params: { id: 'crm-1' } })
      expect(response.status).toBe(403)
    })

    it('deletes risk mapping and audits it', async () => {
      const writeAuditEvent = jest.fn().mockResolvedValue(undefined)
      const destroyMock = jest.fn().mockResolvedValue(undefined)

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requireMutationAuth: jest.fn(),
      }))
      jest.doMock('@/lib/models', () => ({
        ControlRiskMapping: {
          findByPk: jest.fn().mockResolvedValue({
            ...mockRiskMapping,
            destroy: destroyMock,
          }),
        },
      }))
      jest.doMock('@/lib/audit', () => ({ writeAuditEvent }))

      const { DELETE } = await import('@/app/api/v1/internal/control-risk-mappings/[id]/route')
      const request = new Request('http://localhost/api/v1/internal/control-risk-mappings/crm-1', {
        method: 'DELETE', headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await DELETE(request, { params: { id: 'crm-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(destroyMock).toHaveBeenCalled()
      expect(body.data.id).toBe('crm-1')
      expect(writeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'mapping.delete', target_type: 'control_risk_mapping' }),
      )
    })
  })
})
