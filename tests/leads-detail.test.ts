import { NextRequest } from 'next/server'

jest.mock('@/lib/auth/session', () => ({
  getInternalSession: jest.fn(),
  isSessionError: (result: Record<string, unknown>) => 'error' in result,
}))

jest.mock('@/lib/models/Lead', () => ({
  Lead: { findByPk: jest.fn() },
}))

jest.mock('@/lib/models/LeadNote', () => ({
  LeadNote: { findAll: jest.fn(), create: jest.fn(), findOne: jest.fn() },
}))

jest.mock('@/lib/models', () => ({
  Lead: { findByPk: jest.fn() },
  LeadNote: { findAll: jest.fn(), create: jest.fn(), findOne: jest.fn() },
}))

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(),
}))

import { GET as GET_LEAD } from '@/app/api/v1/internal/leads/[id]/route'
import { GET as GET_NOTES, POST as POST_NOTE } from '@/app/api/v1/internal/leads/[id]/notes/route'
import { PUT as PUT_NOTE, DELETE as DELETE_NOTE } from '@/app/api/v1/internal/leads/[id]/notes/[noteId]/route'
import { getInternalSession } from '@/lib/auth/session'
import { Lead } from '@/lib/models'
import { LeadNote } from '@/lib/models'
import { logAuditEvent } from '@/lib/audit'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>
const mockLeadFindByPk = Lead.findByPk as jest.MockedFunction<typeof Lead.findByPk>
const mockLeadNoteFindAll = LeadNote.findAll as jest.MockedFunction<typeof LeadNote.findAll>
const mockLeadNoteCreate = LeadNote.create as jest.MockedFunction<typeof LeadNote.create>
const mockLeadNoteFindOne = LeadNote.findOne as jest.MockedFunction<typeof LeadNote.findOne>
const mockLogAuditEvent = logAuditEvent as jest.MockedFunction<typeof logAuditEvent>

const authenticatedUser = {
  id: 'user-1',
  name: 'Test',
  surname: 'User',
  email: 'test@example.com',
  roleId: 'role-1',
  roleName: 'Super Admin' as const,
  status: 'active' as const,
  totpEnabled: true,
  sessionId: 'session-1',
}

const mockLead = {
  id: '550e8400-e29b-41d4-a716-446655440000',
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
  source: 'Website Form',
  status: 'New',
  assigned_owner_id: null,
  nda_required: false,
  demo_status: null,
  contract_status: null,
  created_at: new Date('2026-06-28T00:00:00Z'),
  updated_at: new Date('2026-06-28T00:00:00Z'),
  deleted_at: null,
}

const mockNote = {
  id: '660e8400-e29b-41d4-a716-446655440001',
  lead_id: '550e8400-e29b-41d4-a716-446655440000',
  note_text: 'Test note',
  created_by: 'user-1',
  updated_by: null,
  created_at: new Date('2026-06-28T12:00:00Z'),
  updated_at: new Date('2026-06-28T12:00:00Z'),
  deleted_at: null,
  save: jest.fn().mockResolvedValue(true),
  destroy: jest.fn().mockResolvedValue(true),
}

function makeRequest(url: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): NextRequest {
  const headers: Record<string, string> = {
    authorization: 'Bearer valid-token',
    ...options.headers,
  }
  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }
  return new NextRequest(new Request(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetInternalSession.mockResolvedValue(authenticatedUser)
  mockLeadFindByPk.mockResolvedValue(mockLead)
  mockLeadNoteFindAll.mockResolvedValue([mockNote])
  mockLeadNoteCreate.mockResolvedValue(mockNote)
  mockLeadNoteFindOne.mockResolvedValue(mockNote)
})

const LEAD_ID = '550e8400-e29b-41d4-a716-446655440000'
const NOTE_ID = '660e8400-e29b-41d4-a716-446655440001'

function leadParams() {
  return Promise.resolve({ id: LEAD_ID })
}

function noteParams() {
  return Promise.resolve({ id: LEAD_ID, noteId: NOTE_ID })
}

describe('GET /api/v1/internal/leads/[id]', () => {
  describe('happy path', () => {
    it('returns lead detail for valid id (200)', async () => {
      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}`)
      const res = await GET_LEAD(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(LEAD_ID)
      expect(body.company_name).toBe('Acme Corp')
    })
  })

  describe('not found', () => {
    it('returns 404 when lead does not exist', async () => {
      mockLeadFindByPk.mockResolvedValue(null)

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}`)
      const res = await GET_LEAD(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
    })
  })

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}`, { headers: {} })
      const res = await GET_LEAD(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(401)
    })
  })

  describe('authorization', () => {
    it('returns 403 for read-only auditor reading leads (should pass)', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...authenticatedUser,
        roleName: 'Read-only Auditor',
      })

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}`)
      const res = await GET_LEAD(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(200)
    })
  })

  describe('error handling', () => {
    it('returns 500 on database failure', async () => {
      mockLeadFindByPk.mockRejectedValue(new Error('DB connection lost'))

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}`)
      const res = await GET_LEAD(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('server_error')
    })
  })
})

describe('GET /api/v1/internal/leads/[id]/notes', () => {
  describe('happy path', () => {
    it('returns notes list for valid lead (200)', async () => {
      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`)
      const res = await GET_NOTES(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body).toHaveLength(1)
      expect(body[0].note_text).toBe('Test note')
    })
  })

  describe('empty list', () => {
    it('returns empty array when no notes exist', async () => {
      mockLeadNoteFindAll.mockResolvedValue([])

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`)
      const res = await GET_NOTES(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual([])
    })
  })

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`, { headers: {} })
      const res = await GET_NOTES(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(401)
    })
  })
})

describe('POST /api/v1/internal/leads/[id]/notes', () => {
  describe('happy path', () => {
    it('creates a note and returns 201', async () => {
      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`, {
        method: 'POST',
        body: { note_text: 'New note content' },
      })
      const res = await POST_NOTE(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.note_text).toBe('Test note')
      expect(mockLeadNoteCreate).toHaveBeenCalled()
    })

    it('calls logAuditEvent on successful create', async () => {
      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`, {
        method: 'POST',
        body: { note_text: 'New note content' },
      })
      await POST_NOTE(req, { params: { id: LEAD_ID } })

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorInternalUserId: 'user-1',
          action: 'lead_note_created',
          targetType: 'lead_note',
          leadId: LEAD_ID,
        }),
      )
    })
  })

  describe('validation errors', () => {
    it('rejects missing note_text (422)', async () => {
      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`, {
        method: 'POST',
        body: {},
      })
      const res = await POST_NOTE(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe('validation_error')
      expect(body.field).toBe('note_text')
    })

    it('rejects empty whitespace note_text (422)', async () => {
      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`, {
        method: 'POST',
        body: { note_text: '   ' },
      })
      const res = await POST_NOTE(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(422)
    })
  })

  describe('lead not found', () => {
    it('returns 404 when lead does not exist', async () => {
      mockLeadFindByPk.mockResolvedValue(null)

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`, {
        method: 'POST',
        body: { note_text: 'Note on missing lead' },
      })
      const res = await POST_NOTE(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
    })
  })

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`, {
        method: 'POST',
        body: { note_text: 'Test' },
        headers: {},
      })
      const res = await POST_NOTE(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(401)
    })
  })

  describe('authorization', () => {
    it('returns 403 when role lacks create permission', async () => {
      mockGetInternalSession.mockResolvedValue({
        ...authenticatedUser,
        roleName: 'Read-only Auditor',
      })

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes`, {
        method: 'POST',
        body: { note_text: 'Test' },
      })
      const res = await POST_NOTE(req, { params: { id: LEAD_ID } })

      expect(res.status).toBe(403)
    })
  })
})

describe('PUT /api/v1/internal/leads/[id]/notes/[noteId]', () => {
  describe('happy path', () => {
    it('updates a note and returns 200', async () => {
      const saveMock = jest.fn().mockResolvedValue(true)
      mockLeadNoteFindOne.mockResolvedValue({
        ...mockNote,
        note_text: 'Original text',
        save: saveMock,
      })

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes/${NOTE_ID}`, {
        method: 'PUT',
        body: { note_text: 'Updated text' },
      })
      const res = await PUT_NOTE(req, { params: { id: LEAD_ID, noteId: NOTE_ID } })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.note_text).toBe('Updated text')
    })

    it('calls logAuditEvent with before and after values', async () => {
      const saveMock = jest.fn().mockResolvedValue(true)
      mockLeadNoteFindOne.mockResolvedValue({
        ...mockNote,
        note_text: 'Original text',
        save: saveMock,
      })

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes/${NOTE_ID}`, {
        method: 'PUT',
        body: { note_text: 'Updated text' },
      })
      await PUT_NOTE(req, { params: { id: LEAD_ID, noteId: NOTE_ID } })

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'lead_note_updated',
          beforeValues: { note_text: 'Original text' },
          afterValues: { note_text: 'Updated text' },
        }),
      )
    })
  })

  describe('validation errors', () => {
    it('rejects missing note_text (422)', async () => {
      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes/${NOTE_ID}`, {
        method: 'PUT',
        body: {},
      })
      const res = await PUT_NOTE(req, { params: { id: LEAD_ID, noteId: NOTE_ID } })

      expect(res.status).toBe(422)
    })
  })

  describe('not found', () => {
    it('returns 404 when note does not exist', async () => {
      mockLeadNoteFindOne.mockResolvedValue(null)

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes/${NOTE_ID}`, {
        method: 'PUT',
        body: { note_text: 'Updated' },
      })
      const res = await PUT_NOTE(req, { params: { id: LEAD_ID, noteId: NOTE_ID } })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
    })

    it('returns 404 when lead does not exist', async () => {
      mockLeadFindByPk.mockResolvedValue(null)

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes/${NOTE_ID}`, {
        method: 'PUT',
        body: { note_text: 'Updated' },
      })
      const res = await PUT_NOTE(req, { params: { id: LEAD_ID, noteId: NOTE_ID } })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
    })
  })
})

describe('DELETE /api/v1/internal/leads/[id]/notes/[noteId]', () => {
  describe('happy path', () => {
    it('deletes a note and returns 200', async () => {
      const destroyMock = jest.fn().mockResolvedValue(true)
      mockLeadNoteFindOne.mockResolvedValue({ ...mockNote, destroy: destroyMock })

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes/${NOTE_ID}`, {
        method: 'DELETE',
      })
      const res = await DELETE_NOTE(req, { params: { id: LEAD_ID, noteId: NOTE_ID } })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('Note deleted')
      expect(destroyMock).toHaveBeenCalled()
    })

    it('calls logAuditEvent on successful delete', async () => {
      const destroyMock = jest.fn().mockResolvedValue(true)
      mockLeadNoteFindOne.mockResolvedValue({ ...mockNote, destroy: destroyMock })

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes/${NOTE_ID}`, {
        method: 'DELETE',
      })
      await DELETE_NOTE(req, { params: { id: LEAD_ID, noteId: NOTE_ID } })

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'lead_note_deleted',
          targetId: NOTE_ID,
          leadId: LEAD_ID,
        }),
      )
    })
  })

  describe('not found', () => {
    it('returns 404 when note does not exist', async () => {
      mockLeadNoteFindOne.mockResolvedValue(null)

      const req = makeRequest(`http://localhost/api/v1/internal/leads/${LEAD_ID}/notes/${NOTE_ID}`, {
        method: 'DELETE',
      })
      const res = await DELETE_NOTE(req, { params: { id: LEAD_ID, noteId: NOTE_ID } })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
    })
  })
})
