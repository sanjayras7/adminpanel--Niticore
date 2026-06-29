import { can } from '@/lib/authorization'
import { LeadSearchProvider } from '@/lib/search/providers/LeadSearchProvider'
import { TenantSearchProvider } from '@/lib/search/providers/TenantSearchProvider'
import { AuditSearchProvider } from '@/lib/search/providers/AuditSearchProvider'
import { searchAll } from '@/lib/search'
import { SearchContext } from '@/lib/search/types'

jest.mock('@/lib/sequelize', () => ({
  sequelize: {
    query: jest.fn(),
  },
}))

const mockFindAll = jest.fn()
jest.mock('@/lib/models', () => ({
  InternalAuditEvent: {
    findAll: (...args: any[]) => mockFindAll(...args),
  },
}))

jest.useFakeTimers()

const mockSuperAdmin: SearchContext = {
  userId: '00000000-0000-0000-0000-000000000001',
  roleName: 'Super Admin',
}

const mockAuditor: SearchContext = {
  userId: '00000000-0000-0000-0000-000000000002',
  roleName: 'Read-only Auditor',
}

const mockSupport: SearchContext = {
  userId: '00000000-0000-0000-0000-000000000003',
  roleName: 'Support',
}

const mockFinance: SearchContext = {
  userId: '00000000-0000-0000-0000-000000000004',
  roleName: 'Finance/Admin',
}

describe('can (permission matrix integration)', () => {
  it('allows Super Admin shell read', () => {
    expect(can('Super Admin', 'shell', 'read')).toBe(true)
  })

  it('allows Super Admin audit read', () => {
    expect(can('Super Admin', 'audit', 'read')).toBe(true)
  })

  it('allows Read-only Auditor audit read', () => {
    expect(can('Read-only Auditor', 'audit', 'read')).toBe(true)
  })

  it('allows Support audit read', () => {
    expect(can('Support', 'audit', 'read')).toBe(true)
  })

  it('denies Finance/Admin audit read', () => {
    expect(can('Finance/Admin', 'audit', 'read')).toBe(false)
  })

  it('denies unknown module actions', () => {
    expect(can('Support', 'leads', 'audit')).toBe(false)
  })

  it('denies action with empty role list', () => {
    expect(can('Super Admin', 'shell', 'impersonate')).toBe(false)
  })
})

describe('LeadSearchProvider', () => {
  it('returns empty array (stub until Issue 5c)', async () => {
    const provider = new LeadSearchProvider()
    const results = await provider.search('acme', mockSuperAdmin)
    expect(results).toEqual([])
  })

  it('returns empty regardless of query', async () => {
    const provider = new LeadSearchProvider()
    const results1 = await provider.search('', mockSuperAdmin)
    const results2 = await provider.search('anything', mockSuperAdmin)
    expect(results1).toEqual([])
    expect(results2).toEqual([])
  })
})

describe('TenantSearchProvider', () => {
  it('returns empty array (stub until Issue 10a)', async () => {
    const provider = new TenantSearchProvider()
    const results = await provider.search('acme', mockSuperAdmin)
    expect(results).toEqual([])
  })

  it('returns empty regardless of query', async () => {
    const provider = new TenantSearchProvider()
    const results1 = await provider.search('', mockSuperAdmin)
    const results2 = await provider.search('anything', mockSuperAdmin)
    expect(results1).toEqual([])
    expect(results2).toEqual([])
  })
})

describe('AuditSearchProvider', () => {
  beforeEach(() => {
    mockFindAll.mockReset()
  })

  it('returns results when authorized (Super Admin)', async () => {
    const mockEvents = [
      {
        id: 'e1',
        action: 'user.login',
        actor_role: 'Super Admin',
        created_at: new Date(),
      },
      {
        id: 'e2',
        action: 'tenant.created',
        actor_role: 'Super Admin',
        created_at: new Date(Date.now() - 60000),
      },
    ]
    mockFindAll.mockResolvedValue(mockEvents)

    const provider = new AuditSearchProvider()
    const results = await provider.search('login', mockSuperAdmin)

    expect(results).toHaveLength(2)
    expect(results[0].type).toBe('audit')
    expect(results[0].title).toBe('user.login')
    expect(results[0].url).toBe('/internal/audit/e1')
    expect(results[1].url).toBe('/internal/audit/e2')
  })

  it('returns results when authorized (Read-only Auditor)', async () => {
    mockFindAll.mockResolvedValue([
      { id: 'e1', action: 'user.logout', actor_role: 'auditor', created_at: new Date() },
    ])

    const provider = new AuditSearchProvider()
    const results = await provider.search('logout', mockAuditor)
    expect(results).toHaveLength(1)
  })

  it('returns empty when unauthorized role (Finance/Admin)', async () => {
    const provider = new AuditSearchProvider()
    const results = await provider.search('login', mockFinance)
    expect(results).toEqual([])
    expect(mockFindAll).not.toHaveBeenCalled()
  })

  it('returns empty for empty query', async () => {
    const provider = new AuditSearchProvider()
    const results = await provider.search('', mockSuperAdmin)
    expect(results).toEqual([])
    expect(mockFindAll).not.toHaveBeenCalled()
  })

  it('returns empty for whitespace-only query', async () => {
    const provider = new AuditSearchProvider()
    const results = await provider.search('   ', mockSuperAdmin)
    expect(results).toEqual([])
    expect(mockFindAll).not.toHaveBeenCalled()
  })

  it('returns empty on database error', async () => {
    mockFindAll.mockRejectedValue(new Error('DB connection lost'))

    const provider = new AuditSearchProvider()
    const results = await provider.search('login', mockSuperAdmin)
    expect(results).toEqual([])
  })

  it('passes query to findAll via Op.iLike', async () => {
    mockFindAll.mockResolvedValue([])

    const provider = new AuditSearchProvider()
    await provider.search('test query', mockSuperAdmin)

    expect(mockFindAll).toHaveBeenCalledTimes(1)
    const callArg = mockFindAll.mock.calls[0][0]
    expect(callArg).toHaveProperty('limit', 20)
    expect(callArg).toHaveProperty('order')
    expect(callArg).toHaveProperty('where')
  })
})

describe('searchAll', () => {
  beforeEach(() => {
    mockFindAll.mockReset()
    mockFindAll.mockResolvedValue([])
  })

  it('returns combined results from all providers', async () => {
    const results = await searchAll('anything', mockSuperAdmin)
    expect(results.total).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(results.results)).toBe(true)
    expect(results).toHaveProperty('total')
  })

  it('returns empty for empty query', async () => {
    const results = await searchAll('', mockSuperAdmin)
    expect(results).toEqual({ results: [], total: 0 })
  })

  it('returns empty for whitespace-only query', async () => {
    const results = await searchAll('   ', mockSuperAdmin)
    expect(results).toEqual({ results: [], total: 0 })
  })

  it('handles provider failure without throwing', async () => {
    const results = await searchAll('test', mockSuperAdmin)
    expect(results).toHaveProperty('results')
    expect(results).toHaveProperty('total')
  })

  it('sorts results alphabetically by title', async () => {
    const results = await searchAll('test', mockSuperAdmin)
    const titles = results.results.map((r) => r.title)
    const sorted = [...titles].sort((a, b) => a.localeCompare(b))
    expect(titles).toEqual(sorted)
  })

  it('returns audit results when Super Admin searches', async () => {
    mockFindAll.mockResolvedValue([
      { id: 'e1', action: 'role.change', actor_role: 'Super Admin', created_at: new Date() },
    ])

    const results = await searchAll('role', mockSuperAdmin)
    const auditResults = results.results.filter((r) => r.type === 'audit')
    expect(auditResults).toHaveLength(1)
    expect(auditResults[0].title).toBe('role.change')
  })

  it('returns empty audit results for unauthorized role', async () => {
    const results = await searchAll('role', mockFinance)
    const auditResults = results.results.filter((r) => r.type === 'audit')
    expect(auditResults).toHaveLength(0)
  })

  it('returns empty results for a query with no matches', async () => {
    mockFindAll.mockResolvedValue([])
    const results = await searchAll('zzzzzznothing', mockSuperAdmin)
    expect(results.results.filter((r) => r.type === 'audit')).toHaveLength(0)
    expect(results.total).toBe(0)
  })
})
