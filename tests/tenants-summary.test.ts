jest.mock('@/lib/auth')

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
  toJSON: function () { return { ...this } },
}

const mockModule = {
  id: 'mod-1',
  name: 'Plan Tier',
  key: 'plan_tier',
  description: null,
  created_at: mockDate,
  updated_at: mockDate,
}

const mockGovernanceModule = {
  id: 'mod-2',
  name: 'Governance Framework',
  key: 'governance_framework',
  description: null,
  created_at: mockDate,
  updated_at: mockDate,
}

const mockModuleConfig = {
  id: 'cfg-1',
  organization_id: 'org-1',
  module_id: 'mod-1',
  is_enabled: true,
  config_json: { tier: 'enterprise', billing_cycle: 'annual', contract_value: 50000 },
  created_at: mockDate,
  updated_at: mockDate,
}

const mockGovernanceConfig = {
  id: 'cfg-2',
  organization_id: 'org-1',
  module_id: 'mod-2',
  is_enabled: true,
  config_json: null,
  created_at: mockDate,
  updated_at: mockDate,
}

function createMockDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    document_type: 'nda',
    organization_id: 'org-1',
    lead_id: null,
    provider_name: 'DocuSign',
    provider_envelope_id: 'env-1',
    provider_status: 'signed',
    platform_status: 'completed',
    signer_names_json: null,
    signer_emails_json: null,
    sent_at: null,
    viewed_at: null,
    signed_at: mockDate,
    declined_at: null,
    expired_at: null,
    voided_at: null,
    storage_key: 'documents/nda-org-1.pdf',
    file_name: null,
    file_type: null,
    file_size_bytes: null,
    created_by: null,
    created_at: mockDate,
    updated_at: mockDate,
    deleted_at: null,
    ...overrides,
  }
}

describe('GET /api/v1/internal/tenants/[id]/summary', () => {
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

    const { GET } = await import('@/app/api/v1/internal/tenants/[id]/summary/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/summary') as never
    const response = await GET(request, { params: { id: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns 404 when tenant not found', async () => {
    const { getAuthUser } = await import('@/lib/auth')
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' })

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(null),
      },
      OrganizationModuleConfig: { findAll: jest.fn() },
      Module: {},
      LegalDocument: { findAll: jest.fn() },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[id]/summary/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/nonexistent/summary') as never
    const response = await GET(request, { params: { id: 'nonexistent' } })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns full summary for a populated tenant', async () => {
    const { getAuthUser } = await import('@/lib/auth')
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' })

    const mockNda = createMockDoc({
      id: 'doc-nda',
      document_type: 'nda',
      provider_status: 'signed',
      platform_status: 'completed',
      signed_at: mockDate,
      storage_key: 'documents/nda.pdf',
    })

    const mockContract = createMockDoc({
      id: 'doc-contract',
      document_type: 'contract',
      provider_status: 'signed',
      platform_status: 'completed',
      signed_at: mockDate,
      storage_key: 'documents/contract.pdf',
    })

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
      OrganizationModuleConfig: {
        findAll: jest.fn().mockResolvedValue([
          {
            ...mockModuleConfig,
            get: (key: string) => key === 'module' ? mockModule : null,
          },
          {
            ...mockGovernanceConfig,
            get: (key: string) => key === 'module' ? mockGovernanceModule : null,
          },
        ]),
      },
      Module: {},
      LegalDocument: {
        findAll: jest.fn().mockResolvedValue([mockContract, mockNda]),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[id]/summary/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/summary') as never
    const response = await GET(request, { params: { id: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.profile.name).toBe('Acme Corp')
    expect(body.profile.domain).toBe('acme.com')
    expect(body.profile.tenantHash).toBe('abc123def')

    expect(body.lifecycle.status).toBe('active')
    expect(body.lifecycle.onboardingStage).toBeNull()

    expect(body.plan.tier).toBe('enterprise')
    expect(body.plan.billingCycle).toBe('annual')
    expect(body.plan.contractValue).toBe(50000)
    expect(body.plan.enabledModules).toEqual(['plan_tier', 'governance_framework'])

    expect(body.legal.nda).not.toBeNull()
    expect(body.legal.nda.documentType).toBe('nda')
    expect(body.legal.nda.providerStatus).toBe('signed')
    expect(body.legal.contract).not.toBeNull()
    expect(body.legal.contract.documentType).toBe('contract')
  })

  it('handles tenant with no legal documents', async () => {
    const { getAuthUser } = await import('@/lib/auth')
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' })

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
      OrganizationModuleConfig: {
        findAll: jest.fn().mockResolvedValue([]),
      },
      Module: {},
      LegalDocument: {
        findAll: jest.fn().mockResolvedValue([]),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[id]/summary/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/summary') as never
    const response = await GET(request, { params: { id: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.legal.nda).toBeNull()
    expect(body.legal.contract).toBeNull()
    expect(body.plan.enabledModules).toEqual([])
    expect(body.plan.tier).toBe('unconfigured')
  })

  it('handles tenant with unconfigured plan', async () => {
    const { getAuthUser } = await import('@/lib/auth')
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' })

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue({ ...mockOrg, status: 'onboarding' }),
      },
      OrganizationModuleConfig: {
        findAll: jest.fn().mockResolvedValue([]),
      },
      Module: {},
      LegalDocument: {
        findAll: jest.fn().mockResolvedValue([]),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[id]/summary/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/summary') as never
    const response = await GET(request, { params: { id: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.lifecycle.status).toBe('onboarding')
    expect(body.plan.tier).toBe('unconfigured')
    expect(body.plan.billingCycle).toBeNull()
    expect(body.plan.contractValue).toBeNull()
  })

  it('handles tenant with only NDA and no contract', async () => {
    const { getAuthUser } = await import('@/lib/auth')
    ;(getAuthUser as jest.Mock).mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' })

    const mockNda = createMockDoc({
      id: 'doc-nda',
      document_type: 'nda',
      provider_status: 'draft',
      platform_status: 'pending',
      signed_at: null,
    })

    jest.doMock('@/lib/models', () => ({
      Organization: {
        findByPk: jest.fn().mockResolvedValue(mockOrg),
      },
      OrganizationModuleConfig: {
        findAll: jest.fn().mockResolvedValue([]),
      },
      Module: {},
      LegalDocument: {
        findAll: jest.fn().mockResolvedValue([mockNda]),
      },
    }))

    const { GET } = await import('@/app/api/v1/internal/tenants/[id]/summary/route')
    const request = new Request('http://localhost/api/v1/internal/tenants/org-1/summary') as never
    const response = await GET(request, { params: { id: 'org-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.legal.nda).not.toBeNull()
    expect(body.legal.nda.providerStatus).toBe('draft')
    expect(body.legal.contract).toBeNull()
  })
})
