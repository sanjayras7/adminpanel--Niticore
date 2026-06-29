describe('Auth helper - requireSuperAdmin', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('throws AuthError when user is not Super Admin', async () => {
    const { requireSuperAdmin, AuthError } = await import('@/lib/auth')

    const nonAdminUser = {
      id: 'user-2',
      name: 'Normal',
      surname: 'User',
      email: 'normal@example.com',
      internal_role_id: 'role-im',
      roleName: 'Implementation Manager',
    }

    expect(() => requireSuperAdmin(nonAdminUser)).toThrow(AuthError)
    try {
      requireSuperAdmin(nonAdminUser)
    } catch (e: unknown) {
      expect((e as { statusCode: number }).statusCode).toBe(403)
    }
  })

  it('allows Super Admin', async () => {
    const { requireSuperAdmin } = await import('@/lib/auth')

    const superAdminUser = {
      id: 'user-1',
      name: 'Super',
      surname: 'Admin',
      email: 'super@example.com',
      internal_role_id: 'role-superadmin',
      roleName: 'Super Admin',
    }

    expect(() => requireSuperAdmin(superAdminUser)).not.toThrow()
  })
})

describe('POST /api/v1/internal/gates/override', () => {
  const mockDate = new Date('2026-06-29T10:00:00Z')

  beforeEach(() => {
    jest.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockRejectedValue(new (class extends Error {
        statusCode = 401
        constructor() {
          super('Authentication required')
        }
      })()),
      requireSuperAdmin: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gate_type: 'nda', lead_id: 'lead-1', reason: 'Approved' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('forbidden')
    expect(body.message).toBe('Authentication required')
  })

  it('returns 403 when authenticated but not Super Admin', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-2', roleName: 'Implementation Manager' }),
      requireSuperAdmin: jest.fn().mockImplementation(() => {
        throw new (class extends Error {
          statusCode = 403
          constructor() {
            super('Only Super Admin can override gates')
          }
        })()
      }),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-2' },
      body: JSON.stringify({ gate_type: 'nda', lead_id: 'lead-1', reason: 'Approved' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 400 when gate_type is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ lead_id: 'lead-1', reason: 'Approved' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.message).toBe('gate_type is required')
  })

  it('returns 400 when gate_type is invalid', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ gate_type: 'invalid', lead_id: 'lead-1', reason: 'Approved' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.message).toBe("gate_type must be 'nda' or 'contract'")
  })

  it('returns 400 when both lead_id and organization_id are missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ gate_type: 'nda', reason: 'Approved' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.message).toBe('Exactly one of lead_id or organization_id is required')
  })

  it('returns 400 when both lead_id and organization_id are provided', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ gate_type: 'nda', lead_id: 'lead-1', organization_id: 'org-1', reason: 'Approved' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.message).toBe('Provide only one of lead_id or organization_id')
  })

  it('returns 400 when reason is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ gate_type: 'nda', lead_id: 'lead-1' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.message).toBe('reason is required')
  })

  it('returns 400 when reason is empty/whitespace-only', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ gate_type: 'nda', lead_id: 'lead-1', reason: '   ' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.message).toBe('reason must not be empty')
  })

  it('returns 400 when body is not valid JSON', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      headers: new Map([['x-internal-user-id', 'user-1']]),
    } as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('successfully overrides an NDA gate with lead_id', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    const createMock = jest.fn().mockResolvedValue(undefined)
    jest.doMock('@/lib/models', () => ({
      GateOverride: { create: createMock },
    }))

    const auditMock = jest.fn().mockResolvedValue(undefined)
    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: auditMock,
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-user-id': 'user-1',
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'test-agent',
      },
      body: JSON.stringify({ gate_type: 'nda', lead_id: 'lead-1', reason: 'Legal approved' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.gate_type).toBe('nda')
    expect(body.data.lead_id).toBe('lead-1')
    expect(body.data.organization_id).toBeNull()
    expect(body.data.overridden_by).toBe('user-1')
    expect(body.data.reason).toBe('Legal approved')
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(auditMock).toHaveBeenCalledTimes(1)

    const auditCall = auditMock.mock.calls[0][0]
    expect(auditCall.action).toBe('gate_override')
    expect(auditCall.target_type).toBe('gate_override')
    expect(auditCall.actor_role).toBe('Super Admin')
    expect(auditCall.lead_id).toBe('lead-1')
    expect(auditCall.organization_id).toBeNull()
    expect(auditCall.reason).toBe('Legal approved')
  })

  it('successfully overrides a contract gate with organization_id', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    const createMock = jest.fn().mockResolvedValue(undefined)
    jest.doMock('@/lib/models', () => ({
      GateOverride: { create: createMock },
    }))

    const auditMock = jest.fn().mockResolvedValue(undefined)
    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: auditMock,
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-user-id': 'user-1',
      },
      body: JSON.stringify({ gate_type: 'contract', organization_id: 'org-1', reason: 'Contract signed offline', metadata: { source: 'manual' } }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.gate_type).toBe('contract')
    expect(body.data.lead_id).toBeNull()
    expect(body.data.organization_id).toBe('org-1')
    expect(body.data.overridden_by).toBe('user-1')
    expect(body.data.reason).toBe('Contract signed offline')
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(auditMock).toHaveBeenCalledTimes(1)

    const auditCall = auditMock.mock.calls[0][0]
    expect(auditCall.action).toBe('gate_override')
    expect(auditCall.lead_id).toBeNull()
    expect(auditCall.organization_id).toBe('org-1')
  })

  it('returns 500 on database error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireSuperAdmin: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      GateOverride: {
        create: jest.fn().mockRejectedValue(new Error('DB connection failed')),
      },
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/override/route')
    const request = new Request('http://localhost/api/v1/internal/gates/override', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ gate_type: 'nda', lead_id: 'lead-1', reason: 'Approved' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})

describe('canScheduleDemo', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('returns blocked when organization is not found', async () => {
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: jest.fn().mockResolvedValue([]) },
    }))

    const { canScheduleDemo } = await import('@/lib/gate-service')
    const result = await canScheduleDemo('nonexistent-org')

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Organization not found')
    expect(result.gate_type).toBe('nda')
  })

  it('returns allowed when NDA is not required', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([{ id: 'lead-1', nda_required: false }])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canScheduleDemo } = await import('@/lib/gate-service')
    const result = await canScheduleDemo('org-1')

    expect(result.allowed).toBe(true)
    expect(result.gate_type).toBe('nda')
    expect(result.reason).toBeUndefined()
  })

  it('returns blocked when NDA required and not signed, no override', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([{ id: 'lead-1', nda_required: true }])
    mockQuery.mockResolvedValueOnce([])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canScheduleDemo } = await import('@/lib/gate-service')
    const result = await canScheduleDemo('org-1')

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('NDA not signed')
    expect(result.gate_type).toBe('nda')
  })

  it('returns allowed when NDA required and signed', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([{ id: 'lead-1', nda_required: true }])
    mockQuery.mockResolvedValueOnce([{ id: 'doc-1' }])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canScheduleDemo } = await import('@/lib/gate-service')
    const result = await canScheduleDemo('org-1')

    expect(result.allowed).toBe(true)
    expect(result.gate_type).toBe('nda')
    expect(result.document_id).toBe('doc-1')
  })

  it('returns allowed when NDA required, not signed, with valid override', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([{ id: 'lead-1', nda_required: true }])
    mockQuery.mockResolvedValueOnce([])
    mockQuery.mockResolvedValueOnce([{ id: 'override-1' }])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canScheduleDemo } = await import('@/lib/gate-service')
    const result = await canScheduleDemo('org-1', 'override-1')

    expect(result.allowed).toBe(true)
    expect(result.gate_type).toBe('nda')
  })

  it('returns blocked when NDA required, not signed, with invalid override', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([{ id: 'lead-1', nda_required: true }])
    mockQuery.mockResolvedValueOnce([])
    mockQuery.mockResolvedValueOnce([])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canScheduleDemo } = await import('@/lib/gate-service')
    const result = await canScheduleDemo('org-1', 'invalid-override')

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Invalid override')
    expect(result.gate_type).toBe('nda')
  })

  it('returns allowed when NDA not required, even with invalid override', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([{ id: 'lead-1', nda_required: false }])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canScheduleDemo } = await import('@/lib/gate-service')
    const result = await canScheduleDemo('org-1', 'some-override')

    expect(result.allowed).toBe(true)
    expect(result.gate_type).toBe('nda')
  })
})

describe('canActivateTenant', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('returns allowed when contract is signed', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([{ id: 'doc-1' }])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canActivateTenant } = await import('@/lib/gate-service')
    const result = await canActivateTenant('org-1')

    expect(result.allowed).toBe(true)
    expect(result.gate_type).toBe('contract')
    expect(result.document_id).toBe('doc-1')
  })

  it('returns blocked when contract not signed, no override', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canActivateTenant } = await import('@/lib/gate-service')
    const result = await canActivateTenant('org-1')

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Contract not signed')
    expect(result.gate_type).toBe('contract')
  })

  it('returns allowed when contract not signed, with valid override', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([])
    mockQuery.mockResolvedValueOnce([{ id: 'override-1' }])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canActivateTenant } = await import('@/lib/gate-service')
    const result = await canActivateTenant('org-1', 'override-1')

    expect(result.allowed).toBe(true)
    expect(result.gate_type).toBe('contract')
  })

  it('returns blocked when contract not signed, with invalid override', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce([])
    mockQuery.mockResolvedValueOnce([])
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: { query: mockQuery },
    }))

    const { canActivateTenant } = await import('@/lib/gate-service')
    const result = await canActivateTenant('org-1', 'invalid-override')

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Invalid override')
    expect(result.gate_type).toBe('contract')
  })
})

describe('POST /api/v1/internal/gates/check-demo', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockRejectedValue(new (class extends Error {
        statusCode = 401
        constructor() {
          super('Authentication required')
        }
      })()),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-demo/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organization_id: 'org-1' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns 403 when role is not permitted', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-2', roleName: 'Customer Success' }),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-demo/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-2' },
      body: JSON.stringify({ organization_id: 'org-1' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 400 when organization_id is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-demo/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({}),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.message).toBe('organization_id is required')
  })

  it('returns gate check result on success', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Implementation Manager' }),
    }))

    jest.doMock('@/lib/gate-service', () => ({
      canScheduleDemo: jest.fn().mockResolvedValue({ allowed: false, reason: 'NDA not signed', gate_type: 'nda' }),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-demo/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ organization_id: 'org-1' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.allowed).toBe(false)
    expect(body.data.reason).toBe('NDA not signed')
  })

  it('returns 500 on internal error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/gate-service', () => ({
      canScheduleDemo: jest.fn().mockRejectedValue(new Error('DB error')),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-demo/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ organization_id: 'org-1' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})

describe('POST /api/v1/internal/gates/check-activation', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockRejectedValue(new (class extends Error {
        statusCode = 401
        constructor() {
          super('Authentication required')
        }
      })()),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-activation/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-activation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organization_id: 'org-1' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns 403 when role is not permitted', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-2', roleName: 'Customer Success' }),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-activation/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-activation', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-2' },
      body: JSON.stringify({ organization_id: 'org-1' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 400 when organization_id is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-activation/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-activation', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({}),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('validation_error')
    expect(body.message).toBe('organization_id is required')
  })

  it('returns gate check result on success', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Implementation Manager' }),
    }))

    jest.doMock('@/lib/gate-service', () => ({
      canActivateTenant: jest.fn().mockResolvedValue({ allowed: true, gate_type: 'contract', document_id: 'doc-1' }),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-activation/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-activation', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ organization_id: 'org-1' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.allowed).toBe(true)
    expect(body.data.document_id).toBe('doc-1')
  })

  it('returns 500 on internal error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))

    jest.doMock('@/lib/gate-service', () => ({
      canActivateTenant: jest.fn().mockRejectedValue(new Error('DB error')),
    }))

    const { POST } = await import('@/app/api/v1/internal/gates/check-activation/route')
    const request = new Request('http://localhost/api/v1/internal/gates/check-activation', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ organization_id: 'org-1' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})
