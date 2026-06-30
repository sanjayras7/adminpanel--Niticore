jest.mock('@/lib/auth/session', () => ({
  ...jest.requireActual('@/lib/auth/session'),
  getInternalSession: jest.fn(),
}))

jest.mock('@/lib/models/Lead', () => ({
  Lead: { findByPk: jest.fn() },
}))

jest.mock('@/lib/models/LegalDocument', () => ({
  LegalDocument: { findOne: jest.fn(), create: jest.fn() },
}))

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(),
}))

jest.mock('@/lib/esign', () => ({
  createESignAdapter: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { getInternalSession, InternalSessionUser } from '@/lib/auth/session'
import { Lead } from '@/lib/models/Lead'
import { LegalDocument } from '@/lib/models/LegalDocument'
import { logAuditEvent } from '@/lib/audit'
import { createESignAdapter } from '@/lib/esign'
import type { InternalRoleName } from '@/lib/permission-matrix'

const VALID_LEAD_ID = '550e8400-e29b-41d4-a716-446655440000'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>
const mockLeadFindByPk = Lead.findByPk as jest.Mock
const mockLegalDocFindOne = LegalDocument.findOne as jest.Mock
const mockLegalDocCreate = LegalDocument.create as jest.Mock
const mockLogAuditEvent = logAuditEvent as jest.Mock
const mockCreateESignAdapter = createESignAdapter as jest.Mock

const mockSessionUser: InternalSessionUser = {
  id: 'user-1',
  name: 'Test',
  surname: 'User',
  email: 'test@example.com',
  roleId: 'role-1',
  roleName: 'Implementation Manager' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-1',
}

function createMockLead(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_LEAD_ID,
    company_name: 'Acme Corp',
    contact_first_name: 'Jane',
    contact_last_name: 'Doe',
    work_email: 'jane@acme.com',
    nda_required: false,
    status: 'New',
    created_at: new Date('2026-06-28T00:00:00Z'),
    updated_at: new Date('2026-06-28T00:00:00Z'),
    deleted_at: null,
    save: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
    ...overrides,
  }
}

function createMockLegalDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    document_type: 'nda',
    lead_id: VALID_LEAD_ID,
    organization_id: null,
    provider_name: null,
    provider_envelope_id: null,
    platform_status: null,
    signer_names_json: null,
    signer_emails_json: null,
    sent_at: null,
    created_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    save: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
    ...overrides,
  }
}

function mockRequest(url: string, body?: unknown, method = 'PATCH'): NextRequest {
  const headers: Record<string, string> = { authorization: 'Bearer valid-token' }
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
  }
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetInternalSession.mockResolvedValue(mockSessionUser)
})

describe('PATCH /api/v1/internal/leads/:leadId/nda', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    const mod = await import('@/app/api/v1/internal/leads/[id]/nda/route')
    handler = mod.PATCH
  })

  describe('authorization', () => {
    it('returns 401 when no session', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })
      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`, { nda_required: true })
      const res = await handler(req)
      expect(res.status).toBe(401)
    })

    it('returns 403 when role lacks nda-contracts update permission', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...mockSessionUser,
        roleName: 'Read-only Auditor' as InternalRoleName,
      })
      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`, { nda_required: true })
      const res = await handler(req)
      expect(res.status).toBe(403)
    })
  })

  describe('input validation', () => {
    it('returns 400 for invalid lead UUID', async () => {
      const req = mockRequest('http://localhost/api/v1/internal/leads/not-a-uuid/nda', { nda_required: true })
      const res = await handler(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_lead_id')
    })

    it('returns 400 for missing body', async () => {
      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`)
      const res = await handler(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 for non-boolean nda_required', async () => {
      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`, { nda_required: 'yes' })
      const res = await handler(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.message).toContain('boolean')
    })
  })

  describe('business logic', () => {
    it('toggles nda_required from false to true', async () => {
      const lead = createMockLead({ nda_required: false, save: jest.fn().mockResolvedValue(true) })
      mockLeadFindByPk.mockResolvedValue(lead)

      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`, { nda_required: true })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(lead.nda_required).toBe(true)
      expect(lead.save).toHaveBeenCalled()
    })

    it('toggles nda_required from true to false', async () => {
      const lead = createMockLead({ nda_required: true, save: jest.fn().mockResolvedValue(true) })
      mockLeadFindByPk.mockResolvedValue(lead)

      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`, { nda_required: false })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(lead.nda_required).toBe(false)
      expect(lead.save).toHaveBeenCalled()
    })

    it('returns 200 with no changes when nda_required is the same', async () => {
      const lead = createMockLead({ nda_required: true, save: jest.fn() })
      mockLeadFindByPk.mockResolvedValue(lead)

      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`, { nda_required: true })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(lead.save).not.toHaveBeenCalled()
    })

    it('returns 404 when lead not found', async () => {
      mockLeadFindByPk.mockResolvedValue(null)

      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`, { nda_required: true })
      const res = await handler(req)

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
    })

    it('returns 404 when lead is soft-deleted', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead({ deleted_at: new Date() }))

      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`, { nda_required: true })
      const res = await handler(req)

      expect(res.status).toBe(404)
    })

    it('audits the change', async () => {
      const lead = createMockLead({ nda_required: false, save: jest.fn().mockResolvedValue(true) })
      mockLeadFindByPk.mockResolvedValue(lead)

      const req = mockRequest(`http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda`, { nda_required: true })
      await handler(req)

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'lead.nda_required_changed',
          targetType: 'lead',
          targetId: VALID_LEAD_ID,
          leadId: VALID_LEAD_ID,
          beforeValues: { nda_required: false },
          afterValues: { nda_required: true },
        }),
      )
    })
  })
})

describe('POST /api/v1/internal/leads/:leadId/nda/send', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    const mod = await import('@/app/api/v1/internal/leads/[id]/nda/send/route')
    handler = mod.POST
  })

  describe('authorization', () => {
    it('returns 401 when no session', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })
      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(401)
    })

    it('returns 403 when role lacks nda-contracts create permission', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...mockSessionUser,
        roleName: 'Read-only Auditor' as InternalRoleName,
      })
      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(403)
    })
  })

  describe('input validation', () => {
    it('returns 400 for invalid lead UUID', async () => {
      const req = mockRequest(
        'http://localhost/api/v1/internal/leads/invalid/nda/send',
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 for missing signer_name', async () => {
      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.message).toContain('signer_name')
    })

    it('returns 400 for missing signer_email', async () => {
      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.message).toContain('signer_email')
    })

    it('returns 400 for invalid email format', async () => {
      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'not-an-email' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.message).toContain('email')
    })
  })

  describe('business logic', () => {
    beforeEach(() => {
      process.env.ESIGN_PROVIDER = 'mock'
    })

    it('returns 404 when lead not found', async () => {
      mockLeadFindByPk.mockResolvedValue(null)

      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(404)
    })

    it('returns 409 when non-terminal NDA already exists', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead())
      mockLegalDocFindOne.mockResolvedValue(createMockLegalDoc({ platform_status: 'sent' }))

      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('conflict')
    })

    it('allows sending when previous NDA is in terminal status', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead())
      mockLegalDocFindOne.mockResolvedValue(createMockLegalDoc({ platform_status: 'signed' }))

      const mockAdapter = {
        createSigningRequest: jest.fn().mockResolvedValue({
          envelopeId: 'env-123',
          providerName: 'mock',
          status: 'sent',
        }),
        sendSigningRequest: jest.fn().mockResolvedValue({
          envelopeId: 'env-123',
          providerName: 'mock',
          status: 'sent',
          sentAt: new Date().toISOString(),
        }),
      }
      mockCreateESignAdapter.mockReturnValue(mockAdapter)
      mockLegalDocCreate.mockResolvedValue(createMockLegalDoc({
        id: 'doc-2',
        platform_status: 'sent',
        provider_name: 'mock',
        provider_envelope_id: 'env-123',
        sent_at: new Date(),
        signer_names_json: JSON.stringify(['Jane Doe']),
        signer_emails_json: JSON.stringify(['jane@acme.com']),
        save: jest.fn().mockResolvedValue(true),
      }))

      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(201)
    })

    it('creates document, calls adapter, returns 201 on success', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead())
      mockLegalDocFindOne.mockResolvedValue(null)

      const mockAdapter = {
        createSigningRequest: jest.fn().mockResolvedValue({
          envelopeId: 'env-123',
          providerName: 'mock',
          status: 'sent',
        }),
        sendSigningRequest: jest.fn().mockResolvedValue({
          envelopeId: 'env-123',
          providerName: 'mock',
          status: 'sent',
          sentAt: new Date().toISOString(),
        }),
      }
      mockCreateESignAdapter.mockReturnValue(mockAdapter)

      const mockDoc = createMockLegalDoc({
        id: 'doc-new',
        platform_status: 'sent',
        provider_name: 'mock',
        provider_envelope_id: 'env-123',
        sent_at: new Date(),
        signer_names_json: JSON.stringify(['Jane Doe']),
        signer_emails_json: JSON.stringify(['jane@acme.com']),
      })
      mockLegalDocCreate.mockResolvedValue(mockDoc)

      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.platform_status).toBe('sent')
      expect(body.document_type).toBe('nda')
      expect(body.lead_id).toBe(VALID_LEAD_ID)

      expect(mockAdapter.createSigningRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'NDA - Acme Corp',
          signers: [{ name: 'Jane Doe', email: 'jane@acme.com' }],
        }),
      )
      expect(mockAdapter.sendSigningRequest).toHaveBeenCalledWith('env-123')
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'legal_document.sent',
          targetType: 'legal_document',
          leadId: VALID_LEAD_ID,
        }),
      )
    })

    it('returns 502 when adapter createSigningRequest fails', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead())
      mockLegalDocFindOne.mockResolvedValue(null)
      mockLegalDocCreate.mockResolvedValue(createMockLegalDoc({ id: 'doc-fail' }))

      const mockAdapter = {
        createSigningRequest: jest.fn().mockRejectedValue(new Error('Network error')),
        sendSigningRequest: jest.fn(),
      }
      mockCreateESignAdapter.mockReturnValue(mockAdapter)

      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(502)
    })

    it('returns 502 when adapter returns error status', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead())
      mockLegalDocFindOne.mockResolvedValue(null)
      mockLegalDocCreate.mockResolvedValue(createMockLegalDoc({ id: 'doc-fail' }))

      const mockAdapter = {
        createSigningRequest: jest.fn().mockResolvedValue({
          envelopeId: 'env-123',
          providerName: 'mock',
          status: 'error',
          errorMessage: 'Provider declined',
        }),
        sendSigningRequest: jest.fn(),
      }
      mockCreateESignAdapter.mockReturnValue(mockAdapter)

      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(502)
    })

    it('returns 502 when adapter sendSigningRequest fails', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead())
      mockLegalDocFindOne.mockResolvedValue(null)
      mockLegalDocCreate.mockResolvedValue(createMockLegalDoc({ id: 'doc-fail' }))

      const mockAdapter = {
        createSigningRequest: jest.fn().mockResolvedValue({
          envelopeId: 'env-123',
          providerName: 'mock',
          status: 'sent',
        }),
        sendSigningRequest: jest.fn().mockRejectedValue(new Error('Send failed')),
      }
      mockCreateESignAdapter.mockReturnValue(mockAdapter)

      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(502)
    })

    it('returns 502 when adapter factory throws', async () => {
      mockLeadFindByPk.mockResolvedValue(createMockLead())
      mockLegalDocFindOne.mockResolvedValue(null)
      mockCreateESignAdapter.mockImplementation(() => { throw new Error('No provider configured') })

      const req = mockRequest(
        `http://localhost/api/v1/internal/leads/${VALID_LEAD_ID}/nda/send`,
        { signer_name: 'Jane Doe', signer_email: 'jane@acme.com' },
        'POST',
      )
      const res = await handler(req)
      expect(res.status).toBe(502)
    })
  })
})
