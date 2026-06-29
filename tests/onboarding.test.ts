import { NextRequest } from 'next/server'
import { checkRateLimit, resetRateLimiter } from '@/lib/rate-limiter'

const mockDate = new Date('2026-06-01T00:00:00Z')

jest.mock('@/lib/auth/session', () => {
  const getInternalSession = jest.fn()
  return { getInternalSession, isSessionError: jest.fn() }
})

jest.mock('@/lib/models', () => ({ WizardState: { findOne: jest.fn() } }))
jest.mock('@/lib/models/Lead', () => ({ Lead: { findByPk: jest.fn() } }))
jest.mock('@/lib/sequelize', () => ({ sequelize: { query: jest.fn() } }))
jest.mock('@/lib/audit', () => ({ logAuditEvent: jest.fn() }))
jest.mock('@/lib/onboard-organization', () => ({ niticore_onboard_organization: jest.fn() }))
jest.mock('@/lib/email', () => ({ sendMagicLinkEmail: jest.fn() }))
jest.mock('@/lib/rate-limiter', () => {
  const checkRateLimit = jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 })
  const resetRateLimiter = jest.fn()
  return { checkRateLimit, resetRateLimiter }
})

import { getInternalSession, isSessionError } from '@/lib/auth/session'
import { Lead } from '@/lib/models/Lead'
import { sequelize } from '@/lib/sequelize'
import { logAuditEvent } from '@/lib/audit'
import { niticore_onboard_organization } from '@/lib/onboard-organization'
import { sendMagicLinkEmail } from '@/lib/email'
import { WizardState } from '@/lib/models'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>
const mockIsSessionError = isSessionError as jest.MockedFunction<typeof isSessionError>
const mockSequelizeQuery = sequelize.query as jest.MockedFunction<typeof sequelize.query>
const mockLeadFindByPk = Lead.findByPk as jest.MockedFunction<typeof Lead.findByPk>
const mockLogAuditEvent = logAuditEvent as jest.MockedFunction<typeof logAuditEvent>
const mockOnboardOrganization = niticore_onboard_organization as jest.MockedFunction<typeof niticore_onboard_organization>
const mockSendMagicLinkEmail = sendMagicLinkEmail as jest.MockedFunction<typeof sendMagicLinkEmail>
const mockWizardFindOne = WizardState.findOne as jest.MockedFunction<typeof WizardState.findOne>

const mockSessionUser = {
  id: 'user-1',
  name: 'Test',
  surname: 'User',
  email: 'test@example.com',
  roleId: 'role-1',
  roleName: 'Super Admin',
  status: 'active' as const,
  totpEnabled: true,
  sessionId: 'session-1',
}

beforeEach(() => {
  jest.clearAllMocks()
  resetRateLimiter()
})

describe('GET /api/v1/internal/onboarding/review', () => {
  it('returns 401 when not authenticated', async () => {
    mockIsSessionError.mockReturnValue(true)
    mockGetInternalSession.mockResolvedValue({
      error: 'unauthorized',
      message: 'Authentication required',
      status: 401,
    })

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/review?leadId=lead-1')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns 400 when leadId is missing', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/review')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 404 when no wizard state exists', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockWizardFindOne.mockResolvedValue(null)

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/review?leadId=nonexistent')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns review data with no warnings for complete state', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockWizardFindOne.mockResolvedValue({
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
    } as any)

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/review?leadId=lead-1')
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
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockWizardFindOne.mockResolvedValue({
      id: 'ws-2',
      lead_id: 'lead-2',
      organization_id: null,
      step_data: {},
      current_step: 'organization',
      completed_steps: [],
      created_at: mockDate,
      updated_at: mockDate,
      deleted_at: null,
    } as any)

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/review?leadId=lead-2')
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
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockWizardFindOne.mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/v1/internal/onboarding/review/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/review?leadId=lead-1')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})

describe('POST /api/v1/internal/onboarding/confirm', () => {
  const validBody = {
    leadId: 'lead-1',
    organizationId: 'org-1',
    sendAdminInvite: true,
  }

  it('returns 401 when not authenticated', async () => {
    mockIsSessionError.mockReturnValue(true)
    mockGetInternalSession.mockResolvedValue({
      error: 'unauthorized',
      message: 'Authentication required',
      status: 401,
    })

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('returns 403 when role lacks permission (Read-only Auditor)', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue({
      ...mockSessionUser,
      roleName: 'Read-only Auditor',
    })

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const response = await POST(request)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('forbidden')
  })

  it('returns 400 when leadId is missing', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: 'org-1', sendAdminInvite: true }),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 400 when organizationId is missing', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadId: 'lead-1', sendAdminInvite: true }),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 404 when lead is not found', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockSequelizeQuery.mockResolvedValue([])

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 400 when lead and organization mismatch', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockSequelizeQuery.mockResolvedValue([{ id: 'lead-1', converted_organization_id: 'org-999' }])

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadId: 'lead-1', organizationId: 'org-1', sendAdminInvite: true }),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_request')
  })

  it('returns 404 when organization is not found', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)

    let callCount = 0
    mockSequelizeQuery.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
      return Promise.resolve([])
    })

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 409 when already provisioned', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)

    let callCount = 0
    mockSequelizeQuery.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
      if (callCount === 2) return Promise.resolve([{ id: 'org-1' }])
      if (callCount === 3) return Promise.resolve([{ id: 'log-1' }])
      return Promise.resolve([[], {}])
    })

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('conflict')
  })

  it('returns 403 when contract gate not met and no override', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)

    mockSequelizeQuery.mockImplementation((sql: string) => {
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
    })

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadId: 'lead-1', organizationId: 'org-1', sendAdminInvite: false }),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('gate_blocked')
    expect(body.gate).toBe('contract_required')
  })

  it('returns 403 when gate override exists but overrideReason is missing', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)

    mockSequelizeQuery.mockImplementation((sql: string) => {
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
    })

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadId: 'lead-1', organizationId: 'org-1', sendAdminInvite: false }),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('gate_blocked')
  })

  it('provisions successfully when contract is signed (happy path)', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockOnboardOrganization.mockResolvedValue('th-generated-123')

    mockSequelizeQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads') && !sql.includes('INSERT') && !sql.includes('UPDATE')) {
        if (sql.includes(':leadId')) {
          return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
        }
        return Promise.resolve([{ work_email: 'john@testcorp.com' }])
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
    })

    mockLeadFindByPk.mockResolvedValue({
      id: 'lead-1',
      company_name: 'Test Corp',
      contact_first_name: 'John',
      contact_last_name: 'Doe',
      work_email: 'john@testcorp.com',
      company_domain: 'testcorp.com',
      region: 'US',
      company_size: '50',
      interested_modules_json: ['mod-1'],
      interested_frameworks_json: ['fw-1'],
    } as any)

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.tenantHash).toBe('th-generated-123')
    expect(body.organizationId).toBe('org-1')
    expect(body.inviteSent).toBe(true)
  })

  it('provisions successfully with gate override (override allowed)', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockOnboardOrganization.mockResolvedValue('th-override-456')

    mockSequelizeQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads') && !sql.includes('INSERT') && !sql.includes('UPDATE')) {
        return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
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
    })

    mockLeadFindByPk.mockResolvedValue({
      id: 'lead-1',
      company_name: 'Test Corp',
      contact_first_name: 'John',
      contact_last_name: 'Doe',
      work_email: 'john@testcorp.com',
    } as any)

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadId: 'lead-1', organizationId: 'org-1', sendAdminInvite: false, overrideReason: 'Customer urgent' }),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.tenantHash).toBe('th-override-456')
  })

  it('returns inviteSent false when invite send fails and provisioning succeeds', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockOnboardOrganization.mockResolvedValue('th-invite-fail')

    mockSequelizeQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads') && !sql.includes('INSERT') && !sql.includes('UPDATE')) {
        if (sql.includes(':leadId')) {
          return Promise.resolve([{ id: 'lead-1', converted_organization_id: 'org-1' }])
        }
        return Promise.resolve([{ work_email: 'admin@testcorp.com' }])
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
    })

    mockLeadFindByPk.mockResolvedValue({
      id: 'lead-1',
      company_name: 'Test Corp',
    } as any)

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.inviteSent).toBe(false)
  })

  it('returns 500 when onboarding function fails', async () => {
    mockIsSessionError.mockReturnValue(false)
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    mockOnboardOrganization.mockRejectedValue(new Error('Provisioning function error'))

    mockSequelizeQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads') && !sql.includes('INSERT') && !sql.includes('UPDATE')) {
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
      return Promise.resolve([[], {}])
    })

    mockLeadFindByPk.mockResolvedValue({
      id: 'lead-1',
      company_name: 'Test Corp',
    } as any)

    const { POST } = await import('@/app/api/v1/internal/onboarding/confirm/route')
    const request = new NextRequest('http://localhost/api/v1/internal/onboarding/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('internal_error')
  })
})
