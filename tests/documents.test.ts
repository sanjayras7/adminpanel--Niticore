jest.mock('@/lib/auth/session', () => ({
  ...jest.requireActual('@/lib/auth/session'),
  getInternalSession: jest.fn(),
}))

jest.mock('@/lib/models/LegalDocument', () => ({
  LegalDocument: { findByPk: jest.fn() },
}))

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(),
}))

jest.mock('@/lib/storage', () => ({
  LocalStorageBackend: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { getInternalSession, InternalSessionUser } from '@/lib/auth/session'
import { LegalDocument } from '@/lib/models/LegalDocument'
import { logAuditEvent } from '@/lib/audit'
import { LocalStorageBackend } from '@/lib/storage'
import type { InternalRoleName } from '@/lib/permission-matrix'

const VALID_DOC_ID = '550e8400-e29b-41d4-a716-446655440000'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>
const mockLegalDocFindByPk = LegalDocument.findByPk as jest.Mock
const mockLogAuditEvent = logAuditEvent as jest.Mock
const mockLocalStorageBackend = LocalStorageBackend as jest.Mock

const mockSessionUser: InternalSessionUser = {
  id: 'user-1',
  name: 'Test',
  surname: 'User',
  email: 'test@example.com',
  roleId: 'role-1',
  roleName: 'Super Admin' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-1',
}

function createMockDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_DOC_ID,
    document_type: 'nda',
    lead_id: 'lead-1',
    organization_id: 'org-1',
    provider_name: 'mock',
    provider_envelope_id: 'env-1',
    platform_status: 'signed',
    storage_key: 'documents/org-1/doc-1/signed_nda.pdf',
    file_name: 'signed_nda.pdf',
    file_type: 'application/pdf',
    file_size_bytes: 1024,
    retention: 'indefinite',
    signed_at: new Date('2026-06-28T00:00:00Z'),
    created_at: new Date('2026-06-28T00:00:00Z'),
    updated_at: new Date('2026-06-28T00:00:00Z'),
    deleted_at: null,
    save: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
    ...overrides,
  }
}

function mockRequest(url: string, method = 'GET'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { authorization: 'Bearer valid-token' },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetInternalSession.mockResolvedValue(mockSessionUser)
})

describe('GET /api/v1/internal/documents/:id (metadata view)', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    const mod = await import('@/app/api/v1/internal/documents/[id]/route')
    handler = mod.GET
  })

  describe('authorization', () => {
    it('returns 401 when no session', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}`)
      const res = await handler(req)
      expect(res.status).toBe(401)
    })

    it('returns 403 when role lacks document-storage read permission', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...mockSessionUser,
        roleName: 'Engineering' as InternalRoleName,
      })
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}`)
      const res = await handler(req)
      expect(res.status).toBe(403)
    })
  })

  describe('input validation', () => {
    it('returns 400 for invalid document UUID', async () => {
      const req = mockRequest('http://localhost/api/v1/internal/documents/not-a-uuid')
      const res = await handler(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_request')
    })
  })

  describe('business logic', () => {
    it('returns 404 when document not found', async () => {
      mockLegalDocFindByPk.mockResolvedValue(null)
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}`)
      const res = await handler(req)
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
    })

    it('returns 403 for Finance/Admin viewing non-contract document', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...mockSessionUser,
        roleName: 'Finance/Admin' as InternalRoleName,
      })
      mockLegalDocFindByPk.mockResolvedValue(createMockDoc({ document_type: 'nda' }))
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}`)
      const res = await handler(req)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('forbidden')
    })

    it('returns 200 with metadata for Finance/Admin viewing contract document', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...mockSessionUser,
        roleName: 'Finance/Admin' as InternalRoleName,
      })
      mockLegalDocFindByPk.mockResolvedValue(createMockDoc({ document_type: 'contract' }))
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}`)
      const res = await handler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(VALID_DOC_ID)
      expect(body.document_type).toBe('contract')
    })

    it('returns 200 with metadata for authorized role', async () => {
      mockLegalDocFindByPk.mockResolvedValue(createMockDoc())
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}`)
      const res = await handler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(VALID_DOC_ID)
      expect(body.document_type).toBe('nda')
      expect(body.file_name).toBe('signed_nda.pdf')
      expect(body.file_size_bytes).toBe(1024)
      expect(body.retention).toBe('indefinite')
    })

    it('audits document view event', async () => {
      mockLegalDocFindByPk.mockResolvedValue(createMockDoc())
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}`)
      await handler(req)
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'document.view',
          targetType: 'legal_document',
          targetId: VALID_DOC_ID,
        }),
      )
    })
  })
})

describe('GET /api/v1/internal/documents/:id/download (file download)', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeAll(async () => {
    const mod = await import('@/app/api/v1/internal/documents/[id]/download/route')
    handler = mod.GET
  })

  describe('authorization', () => {
    it('returns 401 when no session', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}/download`)
      const res = await handler(req)
      expect(res.status).toBe(401)
    })

    it('returns 403 when role lacks document-storage read permission', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...mockSessionUser,
        roleName: 'Engineering' as InternalRoleName,
      })
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}/download`)
      const res = await handler(req)
      expect(res.status).toBe(403)
    })

    it('returns 403 for Customer Success (view but not download)', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...mockSessionUser,
        roleName: 'Customer Success' as InternalRoleName,
      })
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}/download`)
      const res = await handler(req)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('forbidden')
    })

    it('returns 403 for Finance/Admin downloading non-contract document', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...mockSessionUser,
        roleName: 'Finance/Admin' as InternalRoleName,
      })
      mockLegalDocFindByPk.mockResolvedValue(createMockDoc({ document_type: 'nda' }))
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}/download`)
      const res = await handler(req)
      expect(res.status).toBe(403)
    })
  })

  describe('input validation', () => {
    it('returns 400 for invalid document UUID', async () => {
      const req = mockRequest('http://localhost/api/v1/internal/documents/not-a-uuid/download')
      const res = await handler(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_request')
    })
  })

  describe('business logic', () => {
    it('returns 404 when document not found', async () => {
      mockLegalDocFindByPk.mockResolvedValue(null)
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}/download`)
      const res = await handler(req)
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
    })

    it('returns 409 when storage_key is null', async () => {
      mockLegalDocFindByPk.mockResolvedValue(createMockDoc({ storage_key: null }))
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}/download`)
      const res = await handler(req)
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('not_available')
    })

    it('returns 409 when file does not exist on storage backend', async () => {
      mockLegalDocFindByPk.mockResolvedValue(createMockDoc())
      const mockExists = jest.fn().mockResolvedValue(false)
      mockLocalStorageBackend.mockImplementation(() => ({ exists: mockExists }))
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}/download`)
      const res = await handler(req)
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('not_available')
    })

    it('returns 200 and streams file on successful download', async () => {
      mockLegalDocFindByPk.mockResolvedValue(createMockDoc())
      const mockStream = { pipe: jest.fn(), on: jest.fn() }
      const mockExists = jest.fn().mockResolvedValue(true)
      const mockDownload = jest.fn().mockResolvedValue({
        stream: mockStream,
        contentType: 'application/pdf',
        contentLength: 1024,
      })
      mockLocalStorageBackend.mockImplementation(() => ({
        exists: mockExists,
        download: mockDownload,
      }))
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}/download`)
      const res = await handler(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/pdf')
      expect(res.headers.get('Content-Disposition')).toContain('signed_nda.pdf')
    })

    it('audits document download event', async () => {
      mockLegalDocFindByPk.mockResolvedValue(createMockDoc())
      const mockStream = { pipe: jest.fn(), on: jest.fn() }
      const mockExists = jest.fn().mockResolvedValue(true)
      const mockDownload = jest.fn().mockResolvedValue({
        stream: mockStream,
        contentType: 'application/pdf',
        contentLength: 1024,
      })
      mockLocalStorageBackend.mockImplementation(() => ({
        exists: mockExists,
        download: mockDownload,
      }))
      const req = mockRequest(`http://localhost/api/v1/internal/documents/${VALID_DOC_ID}/download`)
      await handler(req)
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'document.download',
          targetType: 'legal_document',
          targetId: VALID_DOC_ID,
        }),
      )
    })
  })
})
