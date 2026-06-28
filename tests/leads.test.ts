jest.mock('@/lib/models/Lead', () => ({
  Lead: { create: jest.fn() },
}))

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn(),
}))

jest.mock('@/lib/sequelize', () => {
  const txn = { commit: jest.fn(), rollback: jest.fn() }
  const txnFn = jest.fn().mockResolvedValue(txn)
  return { sequelize: { transaction: txnFn } }
})

import { POST } from '@/app/api/v1/public/leads/route'
import { Lead } from '@/lib/models/Lead'
import { logAuditEvent } from '@/lib/audit'
import { sequelize } from '@/lib/sequelize'

const mockLeadCreate = (Lead as jest.Mocked<typeof Lead>).create as jest.Mock
const mockLogAuditEvent = logAuditEvent as jest.Mock
const mockTransactionFn = (sequelize as jest.Mocked<typeof sequelize>).transaction as jest.Mock

function mockRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/v1/public/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function createMockLead(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    company_name: 'Acme Corp',
    contact_first_name: 'Jane',
    contact_last_name: 'Doe',
    work_email: 'jane@acme.com',
    phone: null,
    source: 'Website Form',
    status: 'New',
    created_at: new Date('2026-06-28T00:00:00Z'),
    updated_at: new Date('2026-06-28T00:00:00Z'),
    deleted_at: null,
    ...overrides,
  }
}

let currentTxn: { commit: jest.Mock; rollback: jest.Mock }

beforeEach(() => {
  jest.clearAllMocks()
  mockLeadCreate.mockResolvedValue(createMockLead())
  currentTxn = { commit: jest.fn(), rollback: jest.fn() }
  mockTransactionFn.mockResolvedValue(currentTxn)
})

describe('POST /api/v1/public/leads', () => {
  describe('happy path', () => {
    it('creates a lead with correct default source and status (201)', async () => {
      const response = await POST(mockRequest({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
      }))

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.source).toBe('Website Form')
      expect(body.status).toBe('New')
      expect(body.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(body.company_name).toBe('Acme Corp')
    })

    it('accepts optional fields and returns them in the response', async () => {
      const phoneValue = '+1-555-0100'
      mockLeadCreate.mockResolvedValue(createMockLead({ phone: phoneValue }))

      const response = await POST(mockRequest({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
        phone: phoneValue,
        company_website: 'https://acme.com',
        country: 'US',
        region: 'North America',
        company_size: '51-200',
        interested_modules_json: ['governance', 'risk'],
        interested_frameworks_json: ['soc2'],
        message: 'Interested in a demo',
      }))

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.phone).toBe(phoneValue)
    })

    it('calls logAuditEvent on successful intake', async () => {
      await POST(mockRequest({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
      }))

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorInternalUserId: '00000000-0000-0000-0000-000000000000',
          actorRole: 'System',
          action: 'lead.intake',
          targetType: 'lead',
          targetId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      )
    })

    it('wraps the create and audit in a transaction and commits', async () => {
      await POST(mockRequest({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
      }))

      expect(mockLeadCreate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ transaction: currentTxn }),
      )
      expect(currentTxn.commit).toHaveBeenCalled()
      expect(currentTxn.rollback).not.toHaveBeenCalled()
    })
  })

  describe('validation errors', () => {
    it('rejects missing required fields (422)', async () => {
      const response = await POST(mockRequest({
        company_name: 'Acme Corp',
      }))

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe('missing_fields')
      expect(body.fields).toEqual(expect.arrayContaining(['contact_first_name', 'contact_last_name', 'work_email']))
    })

    it('rejects empty required fields (422)', async () => {
      const response = await POST(mockRequest({
        company_name: '',
        contact_first_name: 'Jane',
        contact_last_name: '',
        work_email: 'jane@acme.com',
      }))

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe('missing_fields')
      expect(body.fields).toContain('company_name')
      expect(body.fields).toContain('contact_last_name')
    })

    it('rejects invalid email format (422)', async () => {
      const response = await POST(mockRequest({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'not-an-email',
      }))

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe('invalid_email')
    })

    it('rejects malformed JSON body (400)', async () => {
      const req = new Request('http://localhost:3000/api/v1/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      })

      const response = await POST(req)
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('malformed_json')
    })

    it('rejects non-object JSON body (400)', async () => {
      const response = await POST(mockRequest('just a string'))

      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe('malformed_json')
    })
  })

  describe('field handling', () => {
    it('silently ignores unexpected fields', async () => {
      await POST(mockRequest({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
        extra_field_1: 'should be ignored',
        extra_field_2: 123,
      }))

      const createCall = mockLeadCreate.mock.calls[0][0]
      expect(createCall.extra_field_1).toBeUndefined()
      expect(createCall.extra_field_2).toBeUndefined()
    })

    it('overrides client-supplied source to "Website Form"', async () => {
      await POST(mockRequest({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
        source: 'Manual Entry',
      }))

      const createCall = mockLeadCreate.mock.calls[0][0]
      expect(createCall.source).toBe('Website Form')
    })

    it('overrides client-supplied status to "New"', async () => {
      await POST(mockRequest({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
        status: 'Qualified',
      }))

      const createCall = mockLeadCreate.mock.calls[0][0]
      expect(createCall.status).toBe('New')
    })

    it('normalizes whitespace on string fields', async () => {
      await POST(mockRequest({
        company_name: '  Acme Corp  ',
        contact_first_name: ' Jane ',
        contact_last_name: 'Doe ',
        work_email: ' jane@acme.com ',
      }))

      const createCall = mockLeadCreate.mock.calls[0][0]
      expect(createCall.company_name).toBe('Acme Corp')
      expect(createCall.contact_first_name).toBe('Jane')
      expect(createCall.contact_last_name).toBe('Doe')
      expect(createCall.work_email).toBe('jane@acme.com')
    })
  })

  describe('error handling', () => {
    it('returns 500 on DB write failure and rolls back transaction', async () => {
      mockLeadCreate.mockRejectedValue(new Error('DB connection lost'))

      const response = await POST(mockRequest({
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
      }))

      expect(response.status).toBe(500)
      expect(currentTxn.rollback).toHaveBeenCalled()
    })

    it('does not check for duplicates — always creates a new row', async () => {
      const firstLead = createMockLead({ id: 'uuid-1' })
      const secondLead = createMockLead({ id: 'uuid-2' })
      mockLeadCreate
        .mockResolvedValueOnce(firstLead)
        .mockResolvedValueOnce(secondLead)

      const body = {
        company_name: 'Acme Corp',
        contact_first_name: 'Jane',
        contact_last_name: 'Doe',
        work_email: 'jane@acme.com',
      }

      const res1 = await POST(mockRequest(body))
      const res2 = await POST(mockRequest(body))

      expect(res1.status).toBe(201)
      expect(res2.status).toBe(201)
      const body1 = await res1.json()
      const body2 = await res2.json()
      expect(body1.id).not.toBe(body2.id)
      expect(mockLeadCreate).toHaveBeenCalledTimes(2)
    })
  })
})
