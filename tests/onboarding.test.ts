import { checkRateLimit, resetRateLimiter } from '@/lib/rate-limiter'

const mockDate = new Date('2026-06-01T00:00:00Z')

beforeEach(() => {
  resetRateLimiter()
})

function mockSequelizeQuery(result: unknown, reject = false) {
  return jest.fn().mockImplementation(() => {
    if (reject) return Promise.reject(new Error('DB error'))
    return Promise.resolve(result)
  })
}

describe('GET /api/v1/internal/onboarding/review', () => {
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

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/review?leadId=lead-1') as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns 400 when leadId is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/review') as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 404 when no wizard state exists', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      WizardState: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/review?leadId=nonexistent') as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns review data with warnings for incomplete steps', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      WizardState: {
        findOne: jest.fn().mockResolvedValue({
          id: 'ws-1',
          lead_id: 'lead-1',
          organization_id: 'org-1',
          step_data: {
            organization: { name: 'Test Corp', domain: 'testcorp.com' },
            modules: [{ moduleId: 'mod-1', subModuleIds: ['sub-1'] }],
            frameworks: ['fw-1'],
            adminInvite: { invited: true, email: 'admin@testcorp.com', status: 'sent' },
          },
          current_step: 'confirm',
          completed_steps: ['organization', 'modules', 'admin'],
          created_at: mockDate,
          updated_at: mockDate,
          deleted_at: null,
        }),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/review?leadId=lead-1') as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.organization.name).toBe('Test Corp')
    expect(body.selectedModules).toHaveLength(1)
    expect(body.selectedFrameworks).toContain('fw-1')
    expect(body.adminInvite.invited).toBe(true)
    expect(body.adminInvite.email).toBe('admin@testcorp.com')
    expect(body.warnings).toHaveLength(0)
    expect(body.contractGate.status).toBe('not_signed')
  })

  it('returns warnings when steps are missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      WizardState: {
        findOne: jest.fn().mockResolvedValue({
          id: 'ws-2',
          lead_id: 'lead-2',
          organization_id: null,
          step_data: {},
          current_step: 'organization',
          completed_steps: [],
          created_at: mockDate,
          updated_at: mockDate,
          deleted_at: null,
        }),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/review?leadId=lead-2') as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.warnings).toContain('Organization step not completed')
    expect(body.warnings).toContain('Module selection step not completed')
    expect(body.warnings).toContain('Admin invite step not completed')
    expect(body.organization).toBeNull()
    expect(body.adminInvite).toBeNull()
  })

  it('returns 500 on DB error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/models', () => ({
      WizardState: {
        findOne: jest.fn().mockRejectedValue(new Error('DB error')),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/review?leadId=lead-1') as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})

describe('POST /api/v1/internal/onboarding/confirm', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  const validBody = {
    leadId: 'lead-1',
    organizationId: 'org-1',
    sendAdminInvite: true,
  }

  function mockDbQueries(options: {
    leadResult?: Array<Record<string, unknown>>
    orgResult?: Array<Record<string, unknown>>
    docResult?: Array<Record<string, unknown>>
    gateResult?: Array<Record<string, unknown>>
    provisioningLogFind?: Array<Record<string, unknown>>
    onboardResult?: Array<Record<string, unknown>>
    inviteResult?: Array<Record<string, unknown>>
    rejectQuery?: boolean
  }) {
    const leadRows = options.leadResult ?? [{ id: 'lead-1', converted_organization_id: 'org-1' }]
    const orgRows = options.orgResult ?? [{ id: 'org-1' }]
    const docRows = options.docResult ?? [{ platform_status: 'signed', storage_key: 'contracts/abc.pdf' }]
    const gateRows = options.gateResult ?? []
    const provisionLogRows = options.provisioningLogFind ?? []
    const onboardRows = options.onboardResult ?? [{ tenant_hash: 'th-abc-123' }]
    const inviteRows = options.inviteResult ?? []

    let callCount = 0

    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation((_sql: string, opts?: { replacements?: Record<string, unknown>; type?: string }) => {
          if (options.rejectQuery) {
            return Promise.reject(new Error('DB error'))
          }

          callCount++

          if (opts?.replacements?.leadId === 'lead-1' && !opts?.replacements?.orgId && !opts?.replacements?.organizationId) {
            return Promise.resolve(leadRows)
          }
          if (opts?.replacements?.orgId === 'org-1') {
            return Promise.resolve(orgRows)
          }
          if ((opts?.replacements?.organizationId === 'org-1' || opts?.replacements?.organizationId === 'org-1') && callCount === 3) {
            return Promise.resolve(provisionLogRows)
          }
          if (opts?.replacements?.organizationId === 'org-1' && opts?.replacements?.id) {
            return Promise.resolve([[], {}])
          }

          return Promise.resolve([[{}], {}])
        }),
      },
    }))
  }

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

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    }) as never

    const response = await POST(request)
    expect(response.status).toBe(401)
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

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'auditor-1' },
      body: JSON.stringify(validBody),
    }) as never

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('returns 400 when leadId is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ organizationId: 'org-1', sendAdminInvite: true }),
    }) as never

    const response = await POST(request)
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 400 when organizationId is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ leadId: 'lead-1', sendAdminInvite: true }),
    }) as never

    const response = await POST(request)
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 404 when lead is not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockResolvedValue([]),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify(validBody),
    }) as never

    const response = await POST(request)
    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 400 when lead and organization mismatch', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockResolvedValue([{ id: 'lead-1', converted_organization_id: 'org-999' }]),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ leadId: 'lead-1', organizationId: 'org-1', sendAdminInvite: true }),
    }) as never

    const response = await POST(request)
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 404 when organization is not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation(() => {
          queryCallCount++
          if (queryCallCount === 1) return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
          return Promise.resolve([])
        }),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify(validBody),
    }) as never

    const response = await POST(request)
    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 409 when already provisioned', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation(() => {
          queryCallCount++
          if (queryCallCount === 1) return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
          if (queryCallCount === 2) return Promise.resolve([{ id: 'org-1' }])
          if (queryCallCount === 3) return Promise.resolve([{ id: 'log-1' }])
          return Promise.resolve([[], {}])
        }),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify(validBody),
    }) as never

    const response = await POST(request)
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.error).toBe('conflict')
  })

  it('returns 403 when contract gate not met and no override', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation((sql: string) => {
          queryCallCount++

          if (sql.includes('FROM leads')) {
            return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
          }
          if (sql.includes('FROM organizations')) {
            return Promise.resolve([{ id: 'org-1' }])
          }
          if (sql.includes('FROM tenant_provisioning_log')) {
            return Promise.resolve([])
          }
          if (sql.includes('FROM legal_documents')) {
            return Promise.resolve([])
          }
          if (sql.includes('FROM gate_overrides')) {
            return Promise.resolve([])
          }

          return Promise.resolve([[], {}])
        }),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ leadId: 'lead-1', organizationId: 'org-1', sendAdminInvite: false }),
    }) as never

    const response = await POST(request)
    const body = await response.json()
    expect(response.status).toBe(403)
    expect(body.error).toBe('gate_blocked')
    expect(body.gate).toBe('contract_required')
  })

  it('returns 403 when gate override exists but overrideReason is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation((sql: string) => {
          queryCallCount++

          if (sql.includes('FROM leads')) {
            return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
          }
          if (sql.includes('FROM organizations')) {
            return Promise.resolve([{ id: 'org-1' }])
          }
          if (sql.includes('FROM tenant_provisioning_log')) {
            return Promise.resolve([])
          }
          if (sql.includes('FROM legal_documents')) {
            return Promise.resolve([])
          }
          if (sql.includes('FROM gate_overrides')) {
            return Promise.resolve([{ overridden_by: 'user-admin', reason: 'Override reason' }])
          }

          return Promise.resolve([[], {}])
        }),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ leadId: 'lead-1', organizationId: 'org-1', sendAdminInvite: false }),
    }) as never

    const response = await POST(request)
    const body = await response.json()
    expect(response.status).toBe(403)
    expect(body.error).toBe('gate_blocked')
  })

  it('provisions successfully when contract is signed (happy path)', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation((sql: string) => {
          queryCallCount++

          if (sql.includes('FROM leads')) {
            return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1', work_email: 'admin@testcorp.com' }])
          }
          if (sql.includes('FROM organizations')) {
            return Promise.resolve([{ id: 'org-1' }])
          }
          if (sql.includes('FROM tenant_provisioning_log') && sql.includes('WHERE organization_id')) {
            return Promise.resolve([])
          }
          if (sql.includes('FROM legal_documents')) {
            return Promise.resolve([{ platform_status: 'signed', storage_key: 'contracts/abc.pdf' }])
          }
          if (sql.includes('niticore_onboard_organization')) {
            return Promise.resolve([{ tenant_hash: 'th-generated-123' }])
          }
          if (sql.includes('UPDATE tenant_provisioning_log')) {
            return Promise.resolve([[], {}])
          }
          if (sql.includes('INSERT INTO tenant_provisioning_log')) {
            return Promise.resolve([[], {}])
          }
          if (sql.includes('organization_admin_invites')) {
            return Promise.resolve([[], {}])
          }

          return Promise.resolve([[], {}])
        }),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    jest.doMock('@/lib/email', () => ({
      sendMagicLinkEmail: jest.fn().mockResolvedValue(undefined),
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockResolvedValue(undefined),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify(validBody),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.tenantHash).toBe('th-generated-123')
    expect(body.organizationId).toBe('org-1')
    expect(body.inviteSent).toBe(true)
  })

  it('provisions successfully with gate override (override allowed)', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation((sql: string) => {
          queryCallCount++

          if (sql.includes('FROM leads')) {
            return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1', work_email: 'admin@testcorp.com' }])
          }
          if (sql.includes('FROM organizations')) {
            return Promise.resolve([{ id: 'org-1' }])
          }
          if (sql.includes('FROM tenant_provisioning_log') && sql.includes('WHERE organization_id')) {
            return Promise.resolve([])
          }
          if (sql.includes('FROM legal_documents')) {
            return Promise.resolve([])
          }
          if (sql.includes('FROM gate_overrides')) {
            return Promise.resolve([{ overridden_by: 'user-admin', reason: 'Override reason' }])
          }
          if (sql.includes('niticore_onboard_organization')) {
            return Promise.resolve([{ tenant_hash: 'th-override-456' }])
          }
          if (sql.includes('UPDATE tenant_provisioning_log')) {
            return Promise.resolve([[], {}])
          }
          if (sql.includes('INSERT INTO tenant_provisioning_log')) {
            return Promise.resolve([[], {}])
          }
          if (sql.includes('organization_admin_invites')) {
            return Promise.resolve([[], {}])
          }

          return Promise.resolve([[], {}])
        }),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    jest.doMock('@/lib/email', () => ({
      sendMagicLinkEmail: jest.fn().mockResolvedValue(undefined),
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockResolvedValue(undefined),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify({ leadId: 'lead-1', organizationId: 'org-1', sendAdminInvite: false, overrideReason: 'Customer urgent' }),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.tenantHash).toBe('th-override-456')
  })

  it('returns inviteSent false when invite send fails and provisioning succeeds', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation((sql: string) => {
          queryCallCount++

          if (sql.includes('FROM leads')) {
            return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
          }
          if (sql.includes('FROM organizations')) {
            return Promise.resolve([{ id: 'org-1' }])
          }
          if (sql.includes('FROM tenant_provisioning_log') && sql.includes('WHERE organization_id')) {
            return Promise.resolve([])
          }
          if (sql.includes('FROM legal_documents')) {
            return Promise.resolve([{ platform_status: 'signed', storage_key: 'contracts/abc.pdf' }])
          }
          if (sql.includes('niticore_onboard_organization')) {
            return Promise.resolve([{ tenant_hash: 'th-invite-fail' }])
          }
          if (sql.includes('UPDATE tenant_provisioning_log')) {
            return Promise.resolve([[], {}])
          }
          if (sql.includes('INSERT INTO tenant_provisioning_log')) {
            return Promise.resolve([[], {}])
          }
          if (sql.includes('organization_admin_invites')) {
            return Promise.reject(new Error('Invite DB error'))
          }

          return Promise.resolve([[], {}])
        }),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockResolvedValue(undefined),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify(validBody),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.inviteSent).toBe(false)
  })

  it('returns 500 when onboarding function fails', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      requireMutationAuth: jest.fn(),
    }))

    let queryCallCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation((sql: string) => {
          queryCallCount++

          if (sql.includes('FROM leads')) {
            return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
          }
          if (sql.includes('FROM organizations')) {
            return Promise.resolve([{ id: 'org-1' }])
          }
          if (sql.includes('FROM tenant_provisioning_log') && sql.includes('WHERE organization_id')) {
            return Promise.resolve([])
          }
          if (sql.includes('FROM legal_documents')) {
            return Promise.resolve([{ platform_status: 'signed', storage_key: 'contracts/abc.pdf' }])
          }
          if (sql.includes('INSERT INTO tenant_provisioning_log')) {
            return Promise.resolve([[], {}])
          }
          if (sql.includes('niticore_onboard_organization')) {
            return Promise.reject(new Error('Provisioning function error'))
          }

          return Promise.resolve([[], {}])
        }),
      },
    }))

    jest.doMock('@/lib/rate-limiter', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
      resetRateLimiter: jest.fn(),
    }))

    jest.doMock('@/lib/audit', () => ({
      writeAuditEvent: jest.fn().mockResolvedValue(undefined),
    }))

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new Request('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
      body: JSON.stringify(validBody),
    }) as never

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})
