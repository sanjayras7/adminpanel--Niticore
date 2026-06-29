jest.mock('@/lib/auth/session', () => ({
  getInternalSession: jest.fn(),
  isSessionError: jest.fn((result: any) => result && typeof result === 'object' && 'error' in result),
}))

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(),
}))

jest.mock('@/lib/onboard-organization', () => ({
  niticore_onboard_organization: jest.fn(),
}))

jest.mock('@/lib/sequelize', () => ({
  sequelize: {
    transaction: jest.fn(async (callback: (t: any) => Promise<any>) => {
      const t = {}
      return callback(t)
    }),
  },
}))

import { NextRequest } from 'next/server'
import { getInternalSession, InternalSessionUser } from '@/lib/auth/session'
import type { InternalRoleName } from '@/lib/permission-matrix'
import { PATCH as statusHandler } from '@/app/api/v1/internal/leads/[id]/status/route'
import { POST as convertHandler } from '@/app/api/v1/internal/leads/[id]/convert/route'
import { Lead } from '@/lib/models/Lead'
import { logAuditEvent } from '@/lib/audit'
import { niticore_onboard_organization } from '@/lib/onboard-organization'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>
const mockLogAuditEvent = logAuditEvent as jest.Mock
const mockLeadFindByPk = jest.fn()
const mockLeadSave = jest.fn()
const mockOnboardOrg = niticore_onboard_organization as jest.MockedFunction<typeof niticore_onboard_organization>

jest.mock('@/lib/models/Lead', () => ({
  Lead: {
    findByPk: (...args: unknown[]) => mockLeadFindByPk(...args),
  },
}))

const LEAD_ID = '550e8400-e29b-41d4-a716-446655440000'
const ORG_ID = '660e8400-e29b-41d4-a716-446655440001'

const mockSuperAdminUser: InternalSessionUser = {
  id: 'user-sa-001',
  name: 'Admin',
  surname: 'User',
  email: 'admin@niticore.com',
  roleId: 'role-sa-001',
  roleName: 'Super Admin' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-001',
}

const mockImplementManagerUser: InternalSessionUser = {
  id: 'user-im-001',
  name: 'Implement',
  surname: 'Manager',
  email: 'im@niticore.com',
  roleId: 'role-im-001',
  roleName: 'Implementation Manager' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-002',
}

const mockCsUser: InternalSessionUser = {
  id: 'user-cs-001',
  name: 'Customer',
  surname: 'Success',
  email: 'cs@niticore.com',
  roleId: 'role-cs-001',
  roleName: 'Customer Success' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-003',
}

const mockReadOnlyUser: InternalSessionUser = {
  id: 'user-ro-001',
  name: 'Read',
  surname: 'Only',
  email: 'ro@niticore.com',
  roleId: 'role-ro-001',
  roleName: 'Read-only Auditor' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-004',
}

function createMockLead(overrides: Record<string, unknown> = {}) {
  return {
    id: LEAD_ID,
    company_name: 'Acme Corp',
    contact_first_name: 'Jane',
    contact_last_name: 'Doe',
    work_email: 'jane@acme.com',
    phone: null,
    company_domain: 'acme.com',
    company_website: 'https://acme.com',
    country: 'US',
    region: 'North America',
    company_size: '51-200',
    interested_modules_json: ['governance'],
    interested_frameworks_json: ['soc2'],
    message: null,
    source: 'Website Form',
    status: 'New',
    assigned_owner_id: null,
    nda_required: false,
    demo_status: null,
    contract_status: null,
    converted_organization_id: null,
    created_at: new Date('2026-06-28T00:00:00Z'),
    updated_at: new Date('2026-06-28T00:00:00Z'),
    deleted_at: null,
    save: mockLeadSave,
    ...overrides,
  }
}

function mockRequest(
  method: string,
  path: string,
  body: unknown = undefined,
  sessionUser: InternalSessionUser | object = mockSuperAdminUser,
): NextRequest {
  mockGetInternalSession.mockResolvedValue(sessionUser)
  const url = `http://localhost:3000${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-for': '127.0.0.1',
    'user-agent': 'jest-test/1.0',
  }
  if ('error' in (sessionUser as object) === false) {
    headers['authorization'] = 'Bearer valid-session-token'
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function makeStatusRequest(body: unknown, sessionUser?: InternalSessionUser | object): NextRequest {
  return mockRequest('PATCH', `/api/v1/internal/leads/${LEAD_ID}/status`, body, sessionUser)
}

function makeConvertRequest(body: unknown, sessionUser?: InternalSessionUser | object): NextRequest {
  return mockRequest('POST', `/api/v1/internal/leads/${LEAD_ID}/convert`, body, sessionUser)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockLeadFindByPk.mockReset()
  mockLeadSave.mockReset()
  mockLeadSave.mockResolvedValue(undefined)
  mockLogAuditEvent.mockResolvedValue({ id: 'audit-event-001' })
  mockOnboardOrg.mockResolvedValue(ORG_ID)
})

describe('PATCH /api/v1/internal/leads/:id/status', () => {
  describe('happy path — valid transitions', () => {
    it('transitions New → Contacted (200)', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Contacted', reason: 'Called and left voicemail' }))
      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.status).toBe('Contacted')
      expect(body.id).toBe(LEAD_ID)
      expect(mockLeadSave).toHaveBeenCalledTimes(1)
    })

    it('transitions Contacted → Engaged (200)', async () => {
      const lead = createMockLead({ status: 'Contacted' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Engaged' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('Engaged')
    })

    it('transitions Engaged → Negotiation (200)', async () => {
      const lead = createMockLead({ status: 'Engaged' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Negotiation' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('Negotiation')
    })

    it('transitions Negotiation → Converted_to_Tenant (200)', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Converted_to_Tenant' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('Converted_to_Tenant')
    })

    it('transitions Negotiation → Disqualified (200)', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Disqualified' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('Disqualified')
    })

    it('transitions Disqualified → Archived (200)', async () => {
      const lead = createMockLead({ status: 'Disqualified' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Archived' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('Archived')
    })

    it('logs audit event with before/after values on status change', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)

      await statusHandler(makeStatusRequest({ status: 'Contacted', reason: 'Initial outreach' }))

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorInternalUserId: mockSuperAdminUser.id,
          actorRole: 'Super Admin',
          action: 'lead.status_changed',
          targetType: 'lead',
          targetId: LEAD_ID,
          leadId: LEAD_ID,
          beforeValues: { status: 'New' },
          afterValues: { status: 'Contacted' },
          reason: 'Initial outreach',
        }),
      )
    })
  })

  describe('same-status PATCH (idempotent)', () => {
    it('returns 200, no audit event, no save for same status', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'New' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.status).toBe('New')
      expect(mockLeadSave).not.toHaveBeenCalled()
      expect(mockLogAuditEvent).not.toHaveBeenCalled()
    })

    it('returns 200, no audit event for same status on terminal status', async () => {
      const lead = createMockLead({ status: 'Converted_to_Tenant', converted_organization_id: ORG_ID })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Converted_to_Tenant' }))
      expect(response.status).toBe(200)
      expect(mockLeadSave).not.toHaveBeenCalled()
      expect(mockLogAuditEvent).not.toHaveBeenCalled()
    })
  })

  describe('validation — invalid transitions', () => {
    it('rejects New → Converted_to_Tenant (422)', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Converted_to_Tenant' }))
      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe('invalid_transition')
      expect(body.allowed_next_statuses).toEqual(expect.arrayContaining(['Contacted', 'Disqualified', 'Archived']))
    })

    it('rejects New → Engaged (422)', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Engaged' }))
      expect(response.status).toBe(422)
    })

    it('rejects Contacted → Negotiation (422)', async () => {
      const lead = createMockLead({ status: 'Contacted' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Negotiation' }))
      expect(response.status).toBe(422)
    })

    it('rejects transition from Converted_to_Tenant (terminal - 422)', async () => {
      const lead = createMockLead({ status: 'Converted_to_Tenant', converted_organization_id: ORG_ID })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'Archived' }))
      expect(response.status).toBe(422)
    })

    it('rejects transition from Archived (terminal - 422)', async () => {
      const lead = createMockLead({ status: 'Archived' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await statusHandler(makeStatusRequest({ status: 'New' }))
      expect(response.status).toBe(422)
    })
  })

  describe('validation — request validation', () => {
    it('rejects missing status field (400)', async () => {
      const response = await statusHandler(makeStatusRequest({}))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('invalid_request')
    })

    it('rejects empty status string (422)', async () => {
      const response = await statusHandler(makeStatusRequest({ status: '' }))
      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe('invalid_status')
    })

    it('rejects invalid status value (422)', async () => {
      const response = await statusHandler(makeStatusRequest({ status: 'Unknown' }))
      expect(response.status).toBe(422)
      expect((await response.json()).error).toBe('invalid_status')
    })

    it('rejects malformed JSON (400)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/internal/leads/${LEAD_ID}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: 'Bearer valid' },
        body: '{bad-json',
      })
      mockGetInternalSession.mockResolvedValue(mockSuperAdminUser)
      const response = await statusHandler(req)
      expect(response.status).toBe(400)
    })

    it('rejects non-UUID lead ID (400)', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/internal/leads/bad-id/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: 'Bearer valid' },
        body: JSON.stringify({ status: 'Contacted' }),
      })
      mockGetInternalSession.mockResolvedValue(mockSuperAdminUser)
      const response = await statusHandler(req)
      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe('invalid_lead_id')
    })
  })

  describe('lead existence', () => {
    it('returns 404 for non-existent lead', async () => {
      mockLeadFindByPk.mockResolvedValue(null)

      const response = await statusHandler(makeStatusRequest({ status: 'Contacted' }))
      expect(response.status).toBe(404)
    })

    it('returns 404 for soft-deleted lead', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead({ deleted_at: new Date() }))

      const response = await statusHandler(makeStatusRequest({ status: 'Archived' }))
      expect(response.status).toBe(404)
    })
  })

  describe('error handling', () => {
    it('returns 500 on DB lookup failure', async () => {
      mockLeadFindByPk.mockRejectedValue(new Error('DB connection lost'))

      const response = await statusHandler(makeStatusRequest({ status: 'Contacted' }))
      expect(response.status).toBe(500)
    })

    it('returns 500 on DB save failure', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)
      mockLeadSave.mockRejectedValue(new Error('DB write failed'))

      const response = await statusHandler(makeStatusRequest({ status: 'Contacted' }))
      expect(response.status).toBe(500)
    })

    it('still returns 200 if audit event write fails (non-fatal)', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)
      mockLogAuditEvent.mockRejectedValue(new Error('Audit log full'))

      const response = await statusHandler(makeStatusRequest({ status: 'Contacted' }))
      expect(response.status).toBe(200)
    })
  })

  describe('authorization', () => {
    it('allows Super Admin (200)', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)
      const response = await statusHandler(makeStatusRequest({ status: 'Contacted' }, mockSuperAdminUser))
      expect(response.status).toBe(200)
    })

    it('allows Implementation Manager (200)', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)
      const response = await statusHandler(makeStatusRequest({ status: 'Contacted' }, mockImplementManagerUser))
      expect(response.status).toBe(200)
    })

    it('allows Customer Success (200)', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)
      const response = await statusHandler(makeStatusRequest({ status: 'Contacted' }, mockCsUser))
      expect(response.status).toBe(200)
    })

    it('blocks Read-only Auditor (403)', async () => {
      const response = await statusHandler(makeStatusRequest({ status: 'Contacted' }, mockReadOnlyUser))
      expect(response.status).toBe(403)
    })

    it('blocks unauthenticated requests (401)', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })
      const req = new NextRequest(`http://localhost:3000/api/v1/internal/leads/${LEAD_ID}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Contacted' }),
      })
      const response = await statusHandler(req)
      expect(response.status).toBe(401)
    })
  })
})

describe('POST /api/v1/internal/leads/:id/convert', () => {
  describe('happy path — successful conversion', () => {
    it('converts a lead in Negotiation status (200)', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({
        reason: 'Lead passed all qualification criteria',
        plan: 'Enterprise',
        billing_ref: 'BILL-001',
        primary_admin_name: 'Jane Doe',
        primary_admin_email: 'jane@acme.com',
      }))
      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.leadId).toBe(LEAD_ID)
      expect(body.organizationId).toBe(ORG_ID)
      expect(body.status).toBe('Converted_to_Tenant')
      expect(body.prefill.company_name).toBe('Acme Corp')
      expect(body.prefill.plan).toBe('Enterprise')
    })

    it('calls niticore_onboard_organization with lead data', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      await convertHandler(makeConvertRequest({
        reason: 'Qualified',
        plan: 'Enterprise',
      }))

      expect(mockOnboardOrg).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: 'Acme Corp',
          contact_first_name: 'Jane',
          contact_last_name: 'Doe',
          work_email: 'jane@acme.com',
          company_domain: 'acme.com',
          plan: 'Enterprise',
        }),
      )
    })

    it('sets lead status to Converted_to_Tenant and links organization', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({
        reason: 'Qualified',
      }))

      expect(response.status).toBe(200)
      expect(lead.status).toBe('Converted_to_Tenant')
      expect(lead.converted_organization_id).toBe(ORG_ID)
      expect(mockLeadSave).toHaveBeenCalled()
    })

    it('logs audit event lead.converted_to_tenant with org id', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      await convertHandler(makeConvertRequest({
        reason: 'Fully qualified lead',
        plan: 'Enterprise',
      }))

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorInternalUserId: mockSuperAdminUser.id,
          actorRole: 'Super Admin',
          action: 'lead.converted_to_tenant',
          targetType: 'lead',
          targetId: LEAD_ID,
          leadId: LEAD_ID,
          organizationId: ORG_ID,
          beforeValues: { status: 'Negotiation', converted_organization_id: null },
          afterValues: { status: 'Converted_to_Tenant', converted_organization_id: ORG_ID },
          reason: 'Fully qualified lead',
        }),
      )
    })

    it('includes prefill data in response for Issue 8 forward dependency', async () => {
      const lead = createMockLead({ status: 'Negotiation', region: 'Europe', company_size: '201-500' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({
        reason: 'Qualified',
        primary_admin_email: 'admin@acme.com',
      }))

      const body = await response.json()
      expect(body.prefill).toEqual({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
        company_domain: 'acme.com',
        region: 'Europe',
        company_size: '201-500',
        interested_modules_json: ['governance'],
        interested_frameworks_json: ['soc2'],
        plan: null,
        billing_ref: null,
        primary_admin_name: null,
        primary_admin_email: 'admin@acme.com',
      })
    })
  })

  describe('authorization — conversion-specific role check', () => {
    it('allows Super Admin (200)', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)
      const response = await convertHandler(makeConvertRequest({ reason: 'Qualified' }, mockSuperAdminUser))
      expect(response.status).toBe(200)
    })

    it('allows Implementation Manager (200)', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)
      const response = await convertHandler(makeConvertRequest({ reason: 'Qualified' }, mockImplementManagerUser))
      expect(response.status).toBe(200)
    })

    it('blocks Customer Success (403)', async () => {
      const response = await convertHandler(makeConvertRequest({ reason: 'Qualified' }, mockCsUser))
      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('forbidden')
    })

    it('blocks Read-only Auditor (403)', async () => {
      const response = await convertHandler(makeConvertRequest({ reason: 'Qualified' }, mockReadOnlyUser))
      expect(response.status).toBe(403)
    })
  })

  describe('validation — conversion preconditions', () => {
    it('rejects conversion from New status (422)', async () => {
      const lead = createMockLead({ status: 'New' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({ reason: 'Trying to convert early' }))
      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe('invalid_status')
      expect(body.current_status).toBe('New')
    })

    it('rejects conversion from Contacted status (422)', async () => {
      const lead = createMockLead({ status: 'Contacted' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({ reason: 'Test' }))
      expect(response.status).toBe(422)
    })

    it('rejects conversion from Engaged status (422)', async () => {
      const lead = createMockLead({ status: 'Engaged' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({ reason: 'Test' }))
      expect(response.status).toBe(422)
    })

    it('blocks conversion of already-converted lead (409)', async () => {
      const lead = createMockLead({
        status: 'Converted_to_Tenant',
        converted_organization_id: ORG_ID,
      })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({ reason: 'Try again' }))
      expect(response.status).toBe(409)
      const body = await response.json()
      expect(body.error).toBe('already_converted')
    })

    it('requires reason (400)', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({}))
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('reason_required')
    })

    it('rejects empty reason string (400)', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({ reason: '' }))
      expect(response.status).toBe(400)
    })

    it('rejects whitespace-only reason (400)', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({ reason: '   ' }))
      expect(response.status).toBe(400)
    })
  })

  describe('provisioning failure', () => {
    it('returns 500 when niticore_onboard_organization fails and does not change lead', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)
      mockOnboardOrg.mockRejectedValue(new Error('Provisioning timeout'))

      const response = await convertHandler(makeConvertRequest({ reason: 'Qualified' }))
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('conversion_failed')
      expect(lead.status).toBe('Negotiation')
      expect(lead.converted_organization_id).toBeNull()
      expect(mockLeadSave).not.toHaveBeenCalled()
    })
  })

  describe('request validation', () => {
    it('rejects malformed JSON (400)', async () => {
      const req = new NextRequest(`http://localhost:3000/api/v1/internal/leads/${LEAD_ID}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: 'Bearer valid' },
        body: '{bad-json',
      })
      mockGetInternalSession.mockResolvedValue(mockSuperAdminUser)
      const response = await convertHandler(req)
      expect(response.status).toBe(400)
    })

    it('rejects non-UUID lead ID (400)', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/internal/leads/bad-id/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: 'Bearer valid' },
        body: JSON.stringify({ reason: 'Test' }),
      })
      mockGetInternalSession.mockResolvedValue(mockSuperAdminUser)
      const response = await convertHandler(req)
      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe('invalid_lead_id')
    })

    it('accepts optional fields missing or null (200)', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)

      const response = await convertHandler(makeConvertRequest({ reason: 'Qualified' }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.prefill.plan).toBeNull()
      expect(body.prefill.billing_ref).toBeNull()
      expect(body.prefill.primary_admin_name).toBeNull()
      expect(body.prefill.primary_admin_email).toBeNull()
    })
  })

  describe('lead existence', () => {
    it('returns 404 for non-existent lead', async () => {
      mockLeadFindByPk.mockResolvedValue(null)

      const response = await convertHandler(makeConvertRequest({ reason: 'Test' }))
      expect(response.status).toBe(404)
    })

    it('returns 404 for soft-deleted lead', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead({
        status: 'Negotiation',
        deleted_at: new Date(),
      }))

      const response = await convertHandler(makeConvertRequest({ reason: 'Test' }))
      expect(response.status).toBe(404)
    })
  })

  describe('error handling', () => {
    it('returns 500 on DB lookup failure', async () => {
      mockLeadFindByPk.mockRejectedValue(new Error('DB connection lost'))

      const response = await convertHandler(makeConvertRequest({ reason: 'Test' }))
      expect(response.status).toBe(500)
    })

    it('returns 500 on lead save failure after provisioning', async () => {
      const lead = createMockLead({ status: 'Negotiation' })
      mockLeadFindByPk.mockResolvedValue(lead)
      mockLeadSave.mockRejectedValue(new Error('DB write failed'))

      const response = await convertHandler(makeConvertRequest({ reason: 'Qualified' }))
      expect(response.status).toBe(500)
    })
  })
})

describe('validateTransition — lead-status utility', () => {
  it('allows New → Contacted', async () => {
    const { validateTransition } = await import('@/lib/lead-status')
    const result = validateTransition('New' as any, 'Contacted' as any)
    expect(result.valid).toBe(true)
  })

  it('rejects New → Converted_to_Tenant', async () => {
    const { validateTransition } = await import('@/lib/lead-status')
    const result = validateTransition('New' as any, 'Converted_to_Tenant' as any)
    expect(result.valid).toBe(false)
  })

  it('same status is always valid', async () => {
    const { validateTransition } = await import('@/lib/lead-status')
    for (const s of ['New', 'Contacted', 'Engaged', 'Negotiation', 'Converted_to_Tenant', 'Disqualified', 'Archived']) {
      const result = validateTransition(s as any, s as any)
      expect(result.valid).toBe(true)
    }
  })

  it('terminal statuses have no outgoing transitions', async () => {
    const { validateTransition } = await import('@/lib/lead-status')
    expect(validateTransition('Converted_to_Tenant' as any, 'Archived' as any).valid).toBe(false)
    expect(validateTransition('Archived' as any, 'New' as any).valid).toBe(false)
  })

  it('Disqualified → Archived is allowed', async () => {
    const { validateTransition } = await import('@/lib/lead-status')
    const result = validateTransition('Disqualified' as any, 'Archived' as any)
    expect(result.valid).toBe(true)
  })
})
