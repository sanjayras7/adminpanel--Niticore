import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/auth/session', () => ({
  ...jest.requireActual('@/lib/auth/session'),
  getInternalSession: jest.fn(),
}))

import { getInternalSession, InternalSessionUser } from '@/lib/auth/session'
import { InternalAuditEvent } from '@/lib/models'
import type { InternalRoleName } from '@/lib/permission-matrix'

const VALID_UUID = '00000000-0000-4000-8000-000000000001'
const INVALID_UUID = 'not-a-uuid'
const VALID_ISO = '2026-06-25T12:00:00.000Z'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>

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

function buildRequest(url: string): NextRequest {
  return new NextRequest(new Request(url, {
    headers: { authorization: 'Bearer valid-token' },
  }))
}

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('GET /api/v1/audit/timeline - authorization', () => {
  const routePath = 'http://localhost:3000/api/v1/audit/timeline'

  it('returns 401 when no session is found', async () => {
    mockGetInternalSession.mockResolvedValue({
      error: 'unauthorized',
      message: 'Authentication required',
      status: 401,
    })
    const { GET } = await import('@/app/api/v1/audit/timeline/route')
    const req = new NextRequest(new Request(`${routePath}?lead_id=${VALID_UUID}`))
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('allows all roles including Finance/Admin per permission matrix', async () => {
    const financeUser: InternalSessionUser = {
      ...mockSessionUser,
      roleName: 'Finance/Admin' as InternalRoleName,
    }
    mockGetInternalSession.mockResolvedValue(financeUser)
    jest.spyOn(InternalAuditEvent, 'findAll').mockResolvedValue([])
    const { GET } = await import('@/app/api/v1/audit/timeline/route')
    const req = buildRequest(`${routePath}?lead_id=${VALID_UUID}`)
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('allows Super Admin role', async () => {
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    jest.spyOn(InternalAuditEvent, 'findAll').mockResolvedValue([])
    const { GET } = await import('@/app/api/v1/audit/timeline/route')
    const req = buildRequest(`${routePath}?lead_id=${VALID_UUID}`)
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('allows Read-only Auditor role', async () => {
    const auditorUser: InternalSessionUser = {
      ...mockSessionUser,
      roleName: 'Read-only Auditor' as InternalRoleName,
    }
    mockGetInternalSession.mockResolvedValue(auditorUser)
    jest.spyOn(InternalAuditEvent, 'findAll').mockResolvedValue([])
    const { GET } = await import('@/app/api/v1/audit/timeline/route')
    const req = buildRequest(`${routePath}?lead_id=${VALID_UUID}`)
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/v1/audit/timeline - parameter validation', () => {
  const routePath = 'http://localhost:3000/api/v1/audit/timeline'

  async function getWithParams(queryString: string): Promise<{ status: number; body: Record<string, unknown> }> {
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    jest.spyOn(InternalAuditEvent, 'findAll').mockResolvedValue([])
    const { GET } = await import('@/app/api/v1/audit/timeline/route')
    const req = buildRequest(`${routePath}?${queryString}`)
    const res = await GET(req)
    const body = await res.json()
    return { status: res.status, body }
  }

  it('returns 400 when both lead_id and organization_id are provided', async () => {
    const { status, body } = await getWithParams(`lead_id=${VALID_UUID}&organization_id=${VALID_UUID}`)
    expect(status).toBe(400)
    expect(body.error).toBe('invalid_request')
    expect(body.message).toContain('exactly one')
  })

  it('returns 400 when neither lead_id nor organization_id is provided', async () => {
    const { status, body } = await getWithParams('limit=10')
    expect(status).toBe(400)
    expect(body.error).toBe('invalid_request')
    expect(body.message).toContain('exactly one')
  })

  it('returns 400 when lead_id is not a valid UUID', async () => {
    const { status, body } = await getWithParams(`lead_id=${INVALID_UUID}`)
    expect(status).toBe(400)
    expect(body.error).toBe('invalid_request')
    expect(body.message).toContain('lead_id')
  })

  it('returns 400 when organization_id is not a valid UUID', async () => {
    const { status, body } = await getWithParams(`organization_id=${INVALID_UUID}`)
    expect(status).toBe(400)
    expect(body.error).toBe('invalid_request')
    expect(body.message).toContain('organization_id')
  })

  it('returns 400 when cursor is not a valid ISO8601 timestamp', async () => {
    const { status, body } = await getWithParams(`lead_id=${VALID_UUID}&cursor=not-a-date`)
    expect(status).toBe(400)
    expect(body.error).toBe('invalid_request')
    expect(body.message).toContain('cursor')
  })
})

describe('GET /api/v1/audit/timeline - query behavior', () => {
  const routePath = 'http://localhost:3000/api/v1/audit/timeline'

  async function getTimeline(queryString: string, events: Array<Record<string, unknown>>) {
    mockGetInternalSession.mockResolvedValue(mockSessionUser)
    jest.spyOn(InternalAuditEvent, 'findAll').mockImplementation(
      async (opts?: unknown) => {
        const where = (opts as Record<string, unknown>).where as Record<string, unknown>
        const limit = (opts as Record<string, unknown>).limit as number
        const filtered = events.filter((e) => {
          if (where.lead_id && e.lead_id !== where.lead_id) return false
          if (where.organization_id && e.organization_id !== where.organization_id) return false
          if (where.created_at) {
            const opKey = Object.keys(where.created_at as Record<string, unknown>)[0]
            const cursorDate = (where.created_at as Record<string, unknown>)[opKey]
            if (cursorDate && (e.created_at as Date) >= cursorDate) return false
          }
          return true
        })
        const sorted = [...filtered].sort((a, b) => {
          const da = (a.created_at as Date).getTime()
          const db = (b.created_at as Date).getTime()
          return da === db ? (b.id as string).localeCompare(a.id as string) : db - da
        })
        return sorted.slice(0, limit) as unknown as InternalAuditEvent[]
      },
    )

    const { GET } = await import('@/app/api/v1/audit/timeline/route')
    const req = buildRequest(`${routePath}?${queryString}`)
    const res = await GET(req)
    const body = await res.json()
    return { status: res.status, body }
  }

  it('returns events when querying by lead_id', async () => {
    const events = [
      {
        id: 'e1',
        actor_internal_user_id: VALID_UUID,
        actor_role: 'Super Admin',
        action: 'lead.created',
        target_type: 'lead',
        target_id: VALID_UUID,
        organization_id: null,
        lead_id: VALID_UUID,
        before_values: null,
        after_values: { name: 'Test Corp' },
        reason: null,
        metadata: null,
        created_at: new Date('2026-06-26T10:00:00Z'),
      },
    ]
    const { status, body } = await getTimeline(`lead_id=${VALID_UUID}`, events)
    expect(status).toBe(200)
    expect(body.events).toHaveLength(1)
    expect(body.events[0].action).toBe('lead.created')
    expect(body.nextCursor).toBeNull()
  })

  it('returns events when querying by organization_id', async () => {
    const events = [
      {
        id: 'e2',
        actor_internal_user_id: VALID_UUID,
        actor_role: 'System',
        action: 'tenant.provisioned',
        target_type: 'organization',
        target_id: VALID_UUID,
        organization_id: VALID_UUID,
        lead_id: null,
        before_values: null,
        after_values: { status: 'active' },
        reason: null,
        metadata: null,
        created_at: new Date('2026-06-26T11:00:00Z'),
      },
    ]
    const { status, body } = await getTimeline(`organization_id=${VALID_UUID}`, events)
    expect(status).toBe(200)
    expect(body.events).toHaveLength(1)
    expect(body.events[0].action).toBe('tenant.provisioned')
  })

  it('returns events in reverse chronological order', async () => {
    const events = [
      {
        id: 'e1',
        actor_internal_user_id: VALID_UUID,
        actor_role: 'Admin',
        action: 'event.old',
        target_type: 'lead',
        target_id: VALID_UUID,
        organization_id: null,
        lead_id: VALID_UUID,
        before_values: null,
        after_values: null,
        reason: null,
        metadata: null,
        created_at: new Date('2026-06-25T10:00:00Z'),
      },
      {
        id: 'e2',
        actor_internal_user_id: VALID_UUID,
        actor_role: 'Admin',
        action: 'event.new',
        target_type: 'lead',
        target_id: VALID_UUID,
        organization_id: null,
        lead_id: VALID_UUID,
        before_values: null,
        after_values: null,
        reason: null,
        metadata: null,
        created_at: new Date('2026-06-26T10:00:00Z'),
      },
      {
        id: 'e3',
        actor_internal_user_id: VALID_UUID,
        actor_role: 'Admin',
        action: 'event.mid',
        target_type: 'lead',
        target_id: VALID_UUID,
        organization_id: null,
        lead_id: VALID_UUID,
        before_values: null,
        after_values: null,
        reason: null,
        metadata: null,
        created_at: new Date('2026-06-25T12:00:00Z'),
      },
    ]
    const { body } = await getTimeline(`lead_id=${VALID_UUID}`, events)
    expect(body.events).toHaveLength(3)
    expect(body.events[0].action).toBe('event.new')
    expect(body.events[1].action).toBe('event.mid')
    expect(body.events[2].action).toBe('event.old')
  })

  it('returns empty events array when no events found', async () => {
    const { status, body } = await getTimeline(`lead_id=${VALID_UUID}`, [])
    expect(status).toBe(200)
    expect(body.events).toEqual([])
    expect(body.nextCursor).toBeNull()
  })

  it('returns paginated results with nextCursor when more exist', async () => {
    const events = Array.from({ length: 55 }, (_, i) => ({
      id: `e${i}`,
      actor_internal_user_id: VALID_UUID,
      actor_role: 'Admin',
      action: `event.${i}`,
      target_type: 'lead',
      target_id: VALID_UUID,
      organization_id: null,
      lead_id: VALID_UUID,
      before_values: null,
      after_values: null,
      reason: null,
      metadata: null,
      created_at: new Date(Date.UTC(2026, 5, 26, 10, 0, i)),
    }))

    const { body } = await getTimeline(`lead_id=${VALID_UUID}&limit=10`, events)
    expect(body.events).toHaveLength(10)
    expect(body.nextCursor).toEqual(expect.any(String))
  })
})
