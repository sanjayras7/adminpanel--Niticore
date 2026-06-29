const mockDate = new Date('2026-06-01T00:00:00Z')

function buildMockLead(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    company_name: 'Acme Corp',
    contact_first_name: 'John',
    contact_last_name: 'Doe',
    work_email: 'john@acme.com',
    phone: '+1-555-0100',
    company_domain: 'acme.com',
    company_website: 'https://acme.com',
    country: 'US',
    region: 'us-east',
    company_size: '51-200',
    interested_modules_json: ['module-grc', 'module-risk'],
    interested_frameworks_json: [
      { id: 'fw-nist', version: '1.0', control: null },
      { id: 'fw-iso', version: null, control: null },
    ],
    message: 'Interested in compliance automation',
    source: 'website',
    status: 'converted',
    assigned_owner_id: '22222222-2222-4222-8222-222222222222',
    nda_required: true,
    demo_status: 'completed',
    contract_status: 'signed',
    converted_organization_id: '33333333-3333-4333-8333-333333333333',
    created_at: mockDate,
    updated_at: mockDate,
    deleted_at: null,
    ...overrides,
  }
}

describe('GET /api/v1/internal/wizard/prefill', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockRejectedValue(
        Object.assign(new Error('Authentication required'), { statusCode: 401 }),
      ),
    }))
    jest.doMock('@/lib/models/Lead', () => ({ Lead: {} }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=11111111-1111-4111-8111-111111111111',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns 400 when leadId is missing', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({ Lead: {} }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request('http://localhost/api/v1/internal/wizard/prefill') as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 400 when leadId is not a valid UUID', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({ Lead: {} }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=not-a-uuid',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 404 when lead is not found', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({
      Lead: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=11111111-1111-4111-8111-111111111111',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 404 when lead has not been converted', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({
      Lead: {
        findByPk: jest.fn().mockResolvedValue(buildMockLead({ converted_organization_id: null })),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=11111111-1111-4111-8111-111111111111',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
    expect(body.message).toContain('not been converted')
  })

  it('returns full prefill for a fully populated lead', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({
      Lead: {
        findByPk: jest.fn().mockResolvedValue(buildMockLead()),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=11111111-1111-4111-8111-111111111111',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.leadId).toBe('11111111-1111-4111-8111-111111111111')
    expect(body.data.organizationId).toBe('33333333-3333-4333-8333-333333333333')

    expect(body.data.step1.tenantName).toBe('Acme Corp')
    expect(body.data.step1.domain).toBe('acme.com')
    expect(body.data.step1.region).toBe('us-east')
    expect(body.data.step1.ownerId).toBe('22222222-2222-4222-8222-222222222222')
    expect(body.data.step1.notes).toBe('Interested in compliance automation')

    expect(body.data.step3.name).toBe('John')
    expect(body.data.step3.surname).toBe('Doe')
    expect(body.data.step3.email).toBe('john@acme.com')

    expect(body.data.step4).toHaveLength(2)
    expect(body.data.step4[0]).toEqual({ moduleId: 'module-grc', enabled: true })
    expect(body.data.step4[1]).toEqual({ moduleId: 'module-risk', enabled: true })

    expect(body.data.step5.framework_selections).toHaveLength(2)
    expect(body.data.step5.framework_selections[0]).toEqual({ framework_id: 'fw-nist', framework_version_id: '1.0', control_ids: null, risk_threshold: 'medium' })
    expect(body.data.step5.framework_selections[1]).toEqual({ framework_id: 'fw-iso', framework_version_id: null, control_ids: null, risk_threshold: 'medium' })

    expect(body.data.step6.domain).toBe('https://acme.com')
  })

  it('handles partially populated lead gracefully', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({
      Lead: {
        findByPk: jest.fn().mockResolvedValue(
          buildMockLead({
            company_name: 'Partial Corp',
            contact_first_name: 'Jane',
            contact_last_name: 'Smith',
            work_email: 'jane@partial.com',
            region: null,
            company_domain: null,
            company_website: null,
            assigned_owner_id: null,
            message: null,
            interested_modules_json: null,
            interested_frameworks_json: null,
          }),
        ),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=11111111-1111-4111-8111-111111111111',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)

    expect(body.data.step1.tenantName).toBe('Partial Corp')
    expect(body.data.step1.domain).toBeUndefined()
    expect(body.data.step1.region).toBeUndefined()
    expect(body.data.step1.ownerId).toBeUndefined()
    expect(body.data.step1.notes).toBeUndefined()

    expect(body.data.step4).toBeUndefined()
    expect(body.data.step5).toBeUndefined()
    expect(body.data.step6).toBeUndefined()

    expect(body.data.step3.name).toBe('Jane')
    expect(body.data.step3.surname).toBe('Smith')
    expect(body.data.step3.email).toBe('jane@partial.com')
  })

  it('returns 500 on database error', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({
      Lead: {
        findByPk: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=11111111-1111-4111-8111-111111111111',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })

  it('handles unknown framework names by silently omitting them', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({
      Lead: {
        findByPk: jest.fn().mockResolvedValue(
          buildMockLead({
            interested_frameworks_json: [
              { id: 'fw-known', version: '2.0', control: null },
              { id: '', version: null, control: null },
              null,
            ],
          }),
        ),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=11111111-1111-4111-8111-111111111111',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.step5.framework_selections).toHaveLength(1)
    expect(body.data.step5.framework_selections[0].framework_id).toBe('fw-known')
  })

  it('handles interested_modules_json as array of strings', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({
      Lead: {
        findByPk: jest.fn().mockResolvedValue(
          buildMockLead({
            interested_modules_json: ['mod-a', 'mod-b', 'mod-c'],
          }),
        ),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=11111111-1111-4111-8111-111111111111',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.step4).toHaveLength(3)
    expect(body.data.step4[0]).toEqual({ moduleId: 'mod-a', enabled: true })
    expect(body.data.step4[1]).toEqual({ moduleId: 'mod-b', enabled: true })
    expect(body.data.step4[2]).toEqual({ moduleId: 'mod-c', enabled: true })
  })

  it('returns step2 as undefined (no direct lead fields map to it)', async () => {
    jest.doMock('@/lib/auth', () => ({
      getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
    }))
    jest.doMock('@/lib/models/Lead', () => ({
      Lead: {
        findByPk: jest.fn().mockResolvedValue(buildMockLead()),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/wizard/prefill/route')
    const request = new Request(
      'http://localhost/api/v1/internal/wizard/prefill?leadId=11111111-1111-4111-8111-111111111111',
    ) as never
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.step2).toBeUndefined()
  })
})
