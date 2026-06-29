import { NextRequest } from 'next/server'

jest.mock('@/lib/auth/session', () => ({
  getInternalSession: jest.fn(),
  isSessionError: (result: Record<string, unknown>) => 'error' in result,
}))

jest.mock('@/lib/models/Lead', () => ({
  Lead: { findAndCountAll: jest.fn() },
}))

jest.mock('@/lib/models', () => ({
  Lead: { findAndCountAll: jest.fn() },
}))

import { GET } from '@/app/api/v1/internal/leads/route'
import { getInternalSession } from '@/lib/auth/session'
import { Lead } from '@/lib/models'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>
const mockFindAndCountAll = Lead.findAndCountAll as jest.MockedFunction<typeof Lead.findAndCountAll>

const authenticatedUser = {
  id: 'user-1',
  name: 'Test',
  surname: 'User',
  email: 'test@example.com',
  roleId: 'role-1',
  roleName: 'Super Admin',
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-1',
}

function mockRequest(searchParams: Record<string, string> = {}): NextRequest {
  const params = new URLSearchParams(searchParams).toString()
  return new NextRequest(new Request(`http://localhost:3000/api/v1/internal/leads?${params}`), {
    headers: { authorization: 'Bearer valid-token' },
  })
}

function createMockLead(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
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
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetInternalSession.mockResolvedValue(authenticatedUser)
})

describe('GET /api/v1/internal/leads', () => {
  describe('search filter', () => {
    it('filters by company_name search term', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [createMockLead('lead-1', { company_name: 'Acme Corp' })],
        count: 1,
      })

      const req = mockRequest({ search: 'Acme' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].company_name).toBe('Acme Corp')
      expect(body.total).toBe(1)

      const callWhere = mockFindAndCountAll.mock.calls[0][0].where
      expect(callWhere).toHaveProperty('deleted_at', null)
      expect(callWhere[Symbol.for('or')] || callWhere['or']).toBeDefined()
    })

    it('ignores search param shorter than 2 characters', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [createMockLead('lead-1'), createMockLead('lead-2')],
        count: 2,
      })

      const req = mockRequest({ search: 'A' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const callWhere = mockFindAndCountAll.mock.calls[0][0].where
      expect(callWhere[Symbol.for('or')] || callWhere['or']).toBeUndefined()
    })
  })

  describe('status filter', () => {
    it('filters by exact status', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [createMockLead('lead-1', { status: 'Qualified' })],
        count: 1,
      })

      const req = mockRequest({ status: 'Qualified' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].status).toBe('Qualified')

      const callWhere = mockFindAndCountAll.mock.calls[0][0].where
      expect(callWhere.status).toBe('Qualified')
    })
  })

  describe('owner filter', () => {
    it('filters by assigned owner UUID', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000'
      mockFindAndCountAll.mockResolvedValue({
        rows: [createMockLead('lead-1', { assigned_owner_id: ownerId })],
        count: 1,
      })

      const req = mockRequest({ owner: ownerId })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const callWhere = mockFindAndCountAll.mock.calls[0][0].where
      expect(callWhere.assigned_owner_id).toBe(ownerId)
    })

    it('ignores malformed owner UUID', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [createMockLead('lead-1'), createMockLead('lead-2')],
        count: 2,
      })

      const req = mockRequest({ owner: 'not-a-uuid' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const callWhere = mockFindAndCountAll.mock.calls[0][0].where
      expect(callWhere.assigned_owner_id).toBeUndefined()
    })
  })

  describe('source filter', () => {
    it('filters by source', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [createMockLead('lead-1', { source: 'Referral' })],
        count: 1,
      })

      const req = mockRequest({ source: 'Referral' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const callWhere = mockFindAndCountAll.mock.calls[0][0].where
      expect(callWhere.source).toBe('Referral')
    })
  })

  describe('framework filter', () => {
    it('filters by interested framework using JSONB contains', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [createMockLead('lead-1', { interested_frameworks_json: ['soc2'] })],
        count: 1,
      })

      const req = mockRequest({ framework: 'soc2' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const callWhere = mockFindAndCountAll.mock.calls[0][0].where
      expect(callWhere.interested_frameworks_json).toBeDefined()
      expect(callWhere.interested_frameworks_json[Symbol.for('contains')] || callWhere.interested_frameworks_json['contains'])
        .toEqual(['soc2'])
    })
  })

  describe('date range filter', () => {
    it('filters by created_from and created_to', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [createMockLead('lead-1')],
        count: 1,
      })

      const req = mockRequest({ created_from: '2026-06-01', created_to: '2026-06-30' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const callWhere = mockFindAndCountAll.mock.calls[0][0].where
      expect(callWhere.created_at).toBeDefined()
    })
  })

  describe('combined filters', () => {
    it('applies search + status + source together', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [createMockLead('lead-1', {
          company_name: 'Acme Corp',
          status: 'Qualified',
          source: 'Referral',
        })],
        count: 1,
      })

      const req = mockRequest({
        search: 'Acme',
        status: 'Qualified',
        source: 'Referral',
      })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].company_name).toBe('Acme Corp')
      expect(body.data[0].status).toBe('Qualified')
      expect(body.data[0].source).toBe('Referral')

      const callWhere = mockFindAndCountAll.mock.calls[0][0].where
      expect(callWhere.status).toBe('Qualified')
      expect(callWhere.source).toBe('Referral')
      expect(callWhere.deleted_at).toBeNull()
    })
  })

  describe('pagination', () => {
    it('returns correct page slice and total count', async () => {
      const allLeads = Array.from({ length: 25 }, (_, i) =>
        createMockLead(`lead-${i + 1}`, { company_name: `Company ${i + 1}` }),
      )

      mockFindAndCountAll.mockResolvedValue({
        rows: allLeads.slice(0, 20),
        count: 25,
      })

      const req = mockRequest({ page: '1', limit: '20' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(20)
      expect(body.total).toBe(25)
      expect(body.page).toBe(1)
      expect(body.limit).toBe(20)
    })

    it('clamps limit to max 100', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      })

      const req = mockRequest({ limit: '200' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const callArgs = mockFindAndCountAll.mock.calls[0][0]
      expect(callArgs.limit).toBe(100)
    })

    it('defaults to page 1 and limit 20 when not provided', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      })

      const req = mockRequest({})
      const res = await GET(req)

      expect(res.status).toBe(200)
      const callArgs = mockFindAndCountAll.mock.calls[0][0]
      expect(callArgs.offset).toBe(0)
      expect(callArgs.limit).toBe(20)
    })
  })

  describe('empty results', () => {
    it('returns empty data array with total 0 when no matches', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      })

      const req = mockRequest({ status: 'NonExistent' })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual([])
      expect(body.total).toBe(0)
      expect(body.page).toBe(1)
    })
  })

  describe('error handling', () => {
    it('returns 500 on database failure', async () => {
      mockFindAndCountAll.mockRejectedValue(new Error('DB connection lost'))

      const req = mockRequest({})
      const res = await GET(req)

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('server_error')
    })

    it('returns 401 when not authenticated', async () => {
      mockGetInternalSession.mockResolvedValue({
        error: 'unauthorized',
        message: 'Authentication required',
        status: 401,
      })

      const req = new NextRequest(new Request('http://localhost:3000/api/v1/internal/leads'), {
        headers: {},
      })
      const res = await GET(req)

      expect(res.status).toBe(401)
    })
  })
})
