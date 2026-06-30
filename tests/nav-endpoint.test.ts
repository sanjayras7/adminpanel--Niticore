import { NextRequest, NextResponse } from 'next/server'

jest.mock('@/lib/auth/session', () => ({
  ...jest.requireActual('@/lib/auth/session'),
  getInternalSession: jest.fn(),
}))

import { getInternalSession, InternalSessionUser } from '@/lib/auth/session'
import type { InternalRoleName } from '@/lib/permission-matrix'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>

function mockRequest(headers: Record<string, string> = {}, cookies: Record<string, string> = {}): NextRequest {
  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  const url = 'http://localhost/api/v1/internal/nav'
  return new NextRequest(url, {
    headers: { ...headers, ...(cookieStr ? { cookie: cookieStr } : {}) },
  })
}

const superAdminSession: InternalSessionUser = {
  id: 'user-1',
  name: 'Root',
  surname: 'Admin',
  email: 'root@niticore.com',
  roleId: 'role-sa',
  roleName: 'Super Admin' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-1',
}

const financeAdminSession: InternalSessionUser = {
  id: 'user-2',
  name: 'Finance',
  surname: 'User',
  email: 'finance@niticore.com',
  roleId: 'role-fa',
  roleName: 'Finance/Admin' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-2',
}

const supportSession: InternalSessionUser = {
  id: 'user-3',
  name: 'Support',
  surname: 'User',
  email: 'support@niticore.com',
  roleId: 'role-su',
  roleName: 'Support' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-3',
}

const readOnlyAuditorSession: InternalSessionUser = {
  id: 'user-4',
  name: 'Auditor',
  surname: 'User',
  email: 'auditor@niticore.com',
  roleId: 'role-ra',
  roleName: 'Read-only Auditor' as InternalRoleName,
  status: 'active',
  totpEnabled: true,
  sessionId: 'session-4',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/v1/internal/nav', () => {
  it('returns all 11 nav items for Super Admin', async () => {
    mockGetInternalSession.mockResolvedValue(superAdminSession)

    const { GET } = await import('@/app/api/v1/internal/nav/route')
    const req = mockRequest({ authorization: 'Bearer valid-token' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(11)
  })

  it('returns only read-accessible items for Finance/Admin', async () => {
    mockGetInternalSession.mockResolvedValue(financeAdminSession)

    const { GET } = await import('@/app/api/v1/internal/nav/route')
    const req = mockRequest({ authorization: 'Bearer valid-token' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    const labels = body.items.map((i: { label: string }) => i.label)
    expect(labels).toContain('Dashboard')
    expect(labels).toContain('Leads / CRM')
    expect(labels).toContain('Tenants')
    expect(labels).toContain('Contracts')
    expect(labels).toContain('Provisioning')
    expect(labels).toContain('Internal Users / Roles')
    expect(labels).toContain('Settings')

    expect(labels).not.toContain('Support')
    expect(labels).not.toContain('Frameworks / Controls')
    expect(labels).not.toContain('Risk / Taxonomy')
    expect(labels).not.toContain('Audit Logs')
  })

  it('returns Support-accessible items correctly', async () => {
    mockGetInternalSession.mockResolvedValue(supportSession)

    const { GET } = await import('@/app/api/v1/internal/nav/route')
    const req = mockRequest({ authorization: 'Bearer valid-token' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    const labels = body.items.map((i: { label: string }) => i.label)
    expect(labels).toContain('Support')
    expect(labels).toContain('Dashboard')
    expect(labels).toContain('Provisioning')
    expect(labels).toContain('Internal Users / Roles')
  })

  it('returns all read-accessible items for Read-only Auditor', async () => {
    mockGetInternalSession.mockResolvedValue(readOnlyAuditorSession)

    const { GET } = await import('@/app/api/v1/internal/nav/route')
    const req = mockRequest({ authorization: 'Bearer valid-token' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.items.length).toBeGreaterThan(0)
    const labels = body.items.map((i: { label: string }) => i.label)
    expect(labels).toContain('Audit Logs')
    expect(labels).toContain('Internal Users / Roles')
  })

  it('returns 401 when not authenticated', async () => {
    mockGetInternalSession.mockResolvedValue({
      error: 'unauthorized',
      message: 'Authentication required',
      status: 401,
    })

    const { GET } = await import('@/app/api/v1/internal/nav/route')
    const req = mockRequest()
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 403 when user has no role', async () => {
    mockGetInternalSession.mockResolvedValue({
      error: 'forbidden',
      message: 'No role assigned',
      status: 403,
    })

    const { GET } = await import('@/app/api/v1/internal/nav/route')
    const req = mockRequest({ authorization: 'Bearer valid-token' })
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('forbidden')
  })

  it('returns 500 on server error', async () => {
    mockGetInternalSession.mockResolvedValue({
      error: 'server_error',
      message: 'Internal error',
      status: 500,
    })

    const { GET } = await import('@/app/api/v1/internal/nav/route')
    const req = mockRequest({ authorization: 'Bearer valid-token' })
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('server_error')
  })

  it('returns empty items array for unknown role name', async () => {
    const unknownRoleSession: InternalSessionUser = {
      ...superAdminSession,
      roleName: 'NonExistent Role' as InternalRoleName,
    }
    mockGetInternalSession.mockResolvedValue(unknownRoleSession)

    const { GET } = await import('@/app/api/v1/internal/nav/route')
    const req = mockRequest({ authorization: 'Bearer valid-token' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
  })
})
