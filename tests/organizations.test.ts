import { TENANT_STATUSES } from '@/lib/models/Organization'

const mockDate = new Date('2026-01-01T00:00:00Z')

const mockOrganization = {
  id: 'org-1',
  name: 'Test Org',
  tenant_hash: 'abc123',
  status: 'Draft',
  created_at: mockDate,
  updated_at: mockDate,
  deleted_at: null,
}

function createOrgWithStatus(status: string) {
  return {
    ...mockOrganization,
    status,
    save: jest.fn().mockResolvedValue(undefined),
    toJSON: function () { return { ...this, save: undefined, toJSON: undefined } },
  }
}

describe('Tenant status transition map', () => {
  const expectedTransitions: Record<string, string[]> = {
    'Draft': ['Pending Setup', 'Archived'],
    'Pending Setup': ['Active', 'Draft', 'Archived'],
    'Active': ['Suspended', 'Churned'],
    'Suspended': ['Active', 'Churned'],
    'Churned': [],
    'Archived': [],
  }

  it('includes all six tenant statuses', () => {
    expect(TENANT_STATUSES.sort()).toEqual(['Active', 'Archived', 'Churned', 'Draft', 'Pending Setup', 'Suspended'])
  })

  it('exports correct transitions', async () => {
    const route = await import('@/app/api/v1/internal/organizations/[id]/status/route')
    const transitions = route.TENANT_TRANSITIONS as Record<string, string[]>
    expect(Object.keys(transitions).sort()).toEqual(Object.keys(expectedTransitions).sort())
    for (const [from, allowed] of Object.entries(expectedTransitions)) {
      expect(transitions[from].sort()).toEqual([...allowed].sort())
    }
  })
})

describe('canActivateTenant gate function', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('returns allowed=true when signed contract exists', async () => {
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockResolvedValue([{ id: 'doc-1' }]),
        transaction: jest.fn(),
      },
    }))

    const { canActivateTenant } = await import('@/lib/gates')
    const result = await canActivateTenant('org-1')
    expect(result.allowed).toBe(true)
  })

  it('returns allowed=true when override exists', async () => {
    let callCount = 0
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) return Promise.resolve([])
          return Promise.resolve([{ id: 'override-1' }])
        }),
        transaction: jest.fn(),
      },
    }))

    const { canActivateTenant } = await import('@/lib/gates')
    const result = await canActivateTenant('org-1')
    expect(result.allowed).toBe(true)
  })

  it('returns allowed=false when neither signed contract nor override exists', async () => {
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockResolvedValue([]),
        transaction: jest.fn(),
      },
    }))

    const { canActivateTenant } = await import('@/lib/gates')
    const result = await canActivateTenant('org-1')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('no signed contract')
  })

  it('returns allowed=false on DB error (fail-safe)', async () => {
    jest.doMock('@/lib/sequelize', () => ({
      sequelize: {
        query: jest.fn().mockRejectedValue(new Error('DB error')),
        transaction: jest.fn(),
      },
    }))

    const { canActivateTenant } = await import('@/lib/gates')
    const result = await canActivateTenant('org-1')
    expect(result.allowed).toBe(false)
  })
})

describe('requirePermission', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.doMock('@/lib/models', () => ({
      InternalUser: {},
      InternalRole: {},
      MagicLink: {},
      Framework: {},
      FrameworkClassification: {},
      FrameworkVersion: {},
      FrameworkSection: {},
      FrameworkClause: {},
      Organization: {},
    }))
  })

  it('allows Super Admin for tenant:change_status', async () => {
    const { requirePermission } = await import('@/lib/auth')
    const user = { id: 'user-1', roleName: 'Super Admin' } as never
    expect(() => requirePermission('tenant:change_status', user)).not.toThrow()
  })

  it('allows Implementation Manager for tenant:change_status', async () => {
    const { requirePermission } = await import('@/lib/auth')
    const user = { id: 'user-2', roleName: 'Implementation Manager' } as never
    expect(() => requirePermission('tenant:change_status', user)).not.toThrow()
  })

  it('blocks Customer Success for tenant:change_status', async () => {
    const { requirePermission, AuthError } = await import('@/lib/auth')
    const user = { id: 'user-3', roleName: 'Customer Success' } as never
    expect(() => requirePermission('tenant:change_status', user)).toThrow(AuthError)
  })
})

describe('PATCH /api/v1/internal/organizations/[id]/status', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  describe('authorization', () => {
    it('returns 401 when not authenticated', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockRejectedValue(new (class extends Error {
          statusCode = 401
          constructor() {
            super('Authentication required')
          }
        })()),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn(),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn() },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {},
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'Pending Setup' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('unauthorized')
    })

    it('returns 403 for unauthorized role (e.g. Customer Success)', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-cs', roleName: 'Customer Success' }),
        requirePermission: jest.fn().mockImplementation(() => {
          throw new (class extends Error {
            statusCode = 403
            constructor() {
              super('Your role does not have permission to change tenant status.')
            }
          })()
        }),
        canChangeTerminalStatus: jest.fn(),
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {},
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-cs' },
        body: JSON.stringify({ status: 'Pending Setup' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toBe('forbidden')
    })

    it('allows Super Admin to change status', async () => {
      const mockTxn = {
        LOCK: { UPDATE: 'UPDATE' },
        rollback: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn().mockResolvedValue(mockTxn) },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {
          findByPk: jest.fn().mockResolvedValue(createOrgWithStatus('Draft')),
        },
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      jest.doMock('@/lib/gates', () => ({
        canActivateTenant: jest.fn(),
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'Pending Setup' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.organization_id).toBe('org-1')
      expect(body.previous_status).toBe('Draft')
      expect(body.current_status).toBe('Pending Setup')
    })
  })

  describe('valid transitions', () => {
    it('transitions Draft -> Pending Setup', async () => {
      const mockTxn = {
        LOCK: { UPDATE: 'UPDATE' },
        rollback: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn().mockResolvedValue(mockTxn) },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {
          findByPk: jest.fn().mockResolvedValue(createOrgWithStatus('Draft')),
        },
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      jest.doMock('@/lib/gates', () => ({
        canActivateTenant: jest.fn(),
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'Pending Setup' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.previous_status).toBe('Draft')
      expect(body.current_status).toBe('Pending Setup')
    })

    it('transitions Pending Setup -> Active (with signed contract)', async () => {
      const mockTxn = {
        LOCK: { UPDATE: 'UPDATE' },
        rollback: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn().mockResolvedValue(mockTxn) },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {
          findByPk: jest.fn().mockResolvedValue(createOrgWithStatus('Pending Setup')),
        },
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      jest.doMock('@/lib/gates', () => ({
        canActivateTenant: jest.fn().mockResolvedValue({ allowed: true }),
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'Active' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.previous_status).toBe('Pending Setup')
      expect(body.current_status).toBe('Active')
    })

    it('returns 200 with no_change for idempotent transition', async () => {
      const mockTxn = {
        LOCK: { UPDATE: 'UPDATE' },
        rollback: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn().mockResolvedValue(mockTxn) },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {
          findByPk: jest.fn().mockResolvedValue(createOrgWithStatus('Draft')),
        },
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      jest.doMock('@/lib/gates', () => ({
        canActivateTenant: jest.fn(),
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'Draft' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.no_change).toBe(true)
      expect(body.previous_status).toBe('Draft')
      expect(body.current_status).toBe('Draft')
    })
  })

  describe('invalid transitions', () => {
    it('returns 422 for invalid transition', async () => {
      const mockTxn = {
        LOCK: { UPDATE: 'UPDATE' },
        rollback: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn().mockResolvedValue(mockTxn) },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {
          findByPk: jest.fn().mockResolvedValue(createOrgWithStatus('Draft')),
        },
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'Active' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('invalid_transition')
    })

    it('returns 422 for terminal state transition (Churned)', async () => {
      const mockTxn = {
        LOCK: { UPDATE: 'UPDATE' },
        rollback: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn().mockResolvedValue(mockTxn) },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {
          findByPk: jest.fn().mockResolvedValue(createOrgWithStatus('Churned')),
        },
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'Draft' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('invalid_transition')
    })
  })

  describe('Active gate', () => {
    it('returns 403 when activation gate is blocked', async () => {
      const mockTxn = {
        LOCK: { UPDATE: 'UPDATE' },
        rollback: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn().mockResolvedValue(mockTxn) },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {
          findByPk: jest.fn().mockResolvedValue(createOrgWithStatus('Pending Setup')),
        },
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      jest.doMock('@/lib/gates', () => ({
        canActivateTenant: jest.fn().mockResolvedValue({
          allowed: false,
          reason: 'Cannot transition to Active: no signed contract found and no override exists.',
        }),
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'Active' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toBe('activation_blocked')
    })
  })

  describe('validation', () => {
    it('returns 400 when status is missing', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {},
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({}),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('returns 400 for invalid status value', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {},
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'InvalidStatus' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('returns 400 when reason is missing for Suspended transition', async () => {
      const mockTxn = {
        LOCK: { UPDATE: 'UPDATE' },
        rollback: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn().mockResolvedValue(mockTxn) },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {
          findByPk: jest.fn().mockResolvedValue(createOrgWithStatus('Active')),
        },
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      jest.doMock('@/lib/gates', () => ({
        canActivateTenant: jest.fn(),
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'Suspended' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'org-1' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('returns 404 when organization not found', async () => {
      const mockTxn = {
        LOCK: { UPDATE: 'UPDATE' },
        rollback: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
        requirePermission: jest.fn(),
        canChangeTerminalStatus: jest.fn().mockReturnValue(true),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: { transaction: jest.fn().mockResolvedValue(mockTxn) },
      }))

      jest.doMock('@/lib/models/Organization', () => ({
        Organization: {
          findByPk: jest.fn().mockResolvedValue(null),
        },
        TenantStatus: {},
        TENANT_STATUSES: ['Draft', 'Pending Setup', 'Active', 'Suspended', 'Churned', 'Archived'],
      }))

      const { PATCH } = await import('@/app/api/v1/internal/organizations/[id]/status/route')
      const request = new Request('http://localhost/api/v1/internal/organizations/org-1/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-internal-user-id': 'user-1' },
        body: JSON.stringify({ status: 'Pending Setup' }),
      }) as never

      const response = await PATCH(request, { params: { id: 'nonexistent' } })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toBe('not_found')
    })
  })
})
