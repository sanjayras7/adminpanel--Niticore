describe('POST /api/v1/internal/tenants/:id/reprovision', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000'

  beforeEach(() => {
    jest.resetModules()
  })

  describe('input validation', () => {
    it('returns 400 for non-UUID tenant ID', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/invalid-id/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await POST(request, { params: { id: 'invalid-id' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })

    it('returns 400 for empty tenant ID', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants//reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await POST(request, { params: { id: '' } })
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBe('invalid_request')
    })
  })

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockRejectedValue(new (class extends Error {
          statusCode = 401
          constructor() {
            super('Authentication required')
          }
        })()),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: {},
      }) as never

      const response = await POST(request, { params: { id: validUuid } })
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('unauthorized')
    })
  })

  describe('authorization', () => {
    it('allows Super Admin to retry provisioning', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: {
          query: jest.fn().mockResolvedValue([[{ status: 'reprovisioning' }], {}]),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await POST(request, { params: { id: validUuid } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data).toBeDefined()
    })

    it('allows Engineering to retry provisioning', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-2', roleName: 'Engineering' }),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: {
          query: jest.fn().mockResolvedValue([[{ status: 'reprovisioning' }], {}]),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'user-2' },
      }) as never

      const response = await POST(request, { params: { id: validUuid } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data).toBeDefined()
    })

    it('blocks Read-only Auditor with 403', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'auditor-1' },
      }) as never

      const response = await POST(request, { params: { id: validUuid } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toBe('forbidden')
    })

    it('blocks Implementation Manager with 403', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'im-1', roleName: 'Implementation Manager' }),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'im-1' },
      }) as never

      const response = await POST(request, { params: { id: validUuid } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toBe('forbidden')
    })

    it('blocks Customer Success with 403', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'cs-1', roleName: 'Customer Success' }),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'cs-1' },
      }) as never

      const response = await POST(request, { params: { id: validUuid } })
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error).toBe('forbidden')
    })
  })

  describe('edge cases - DB function errors', () => {
    it('returns 404 when tenant is not found', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: {
          query: jest.fn().mockRejectedValue(new Error('Tenant not found')),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await POST(request, { params: { id: validUuid } })
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error).toBe('not_found')
    })

    it('returns 409 when provisioning is not in failed state', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: {
          query: jest.fn().mockRejectedValue(new Error('Provisioning is not in a failed state')),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await POST(request, { params: { id: validUuid } })
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body.error).toBe('conflict')
    })

    it('returns 500 for generic DB errors', async () => {
      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: {
          query: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: jest.fn().mockResolvedValue(undefined),
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      const response = await POST(request, { params: { id: validUuid } })
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toBe('reprovision_failed')
    })
  })

  describe('audit events', () => {
    it('writes audit event on successful retry with organization_id', async () => {
      const mockWriteAudit = jest.fn().mockResolvedValue(undefined)

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Engineering' }),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: {
          query: jest.fn().mockResolvedValue([[{ status: 'reprovisioning' }], {}]),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: mockWriteAudit,
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'user-1', 'x-forwarded-for': '10.0.0.1', 'user-agent': 'test-agent' },
      }) as never

      await POST(request, { params: { id: validUuid } })

      expect(mockWriteAudit).toHaveBeenCalledTimes(1)
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_internal_user_id: 'user-1',
          actor_role: 'Engineering',
          action: 'tenant.reprovision',
          target_type: 'tenant',
          target_id: validUuid,
          organization_id: validUuid,
          after_values: { outcome: 'success' },
          ip_address: '10.0.0.1',
          user_agent: 'test-agent',
        }),
      )
    })

    it('writes audit event on failed retry with organization_id', async () => {
      const mockWriteAudit = jest.fn().mockResolvedValue(undefined)

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'user-1', roleName: 'Super Admin' }),
      }))

      jest.doMock('@/lib/sequelize', () => ({
        sequelize: {
          query: jest.fn().mockRejectedValue(new Error('Tenant not found')),
        },
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: mockWriteAudit,
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'user-1' },
      }) as never

      await POST(request, { params: { id: validUuid } })

      expect(mockWriteAudit).toHaveBeenCalledTimes(1)
      expect(mockWriteAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_internal_user_id: 'user-1',
          actor_role: 'Super Admin',
          action: 'tenant.reprovision',
          target_type: 'tenant',
          target_id: validUuid,
          organization_id: validUuid,
          after_values: { outcome: 'failed', error: 'Tenant not found' },
        }),
      )
    })

    it('does not write audit event for unauthorized role', async () => {
      const mockWriteAudit = jest.fn().mockResolvedValue(undefined)

      jest.doMock('@/lib/auth', () => ({
        getAuthUser: jest.fn().mockResolvedValue({ id: 'auditor-1', roleName: 'Read-only Auditor' }),
      }))

      jest.doMock('@/lib/audit', () => ({
        writeAuditEvent: mockWriteAudit,
      }))

      const { POST } = await import('@/app/api/v1/internal/tenants/[id]/reprovision/route')
      const request = new Request('http://localhost/api/v1/internal/tenants/123e4567-e89b-12d3-a456-426614174000/reprovision', {
        method: 'POST',
        headers: { 'x-internal-user-id': 'auditor-1' },
      }) as never

      await POST(request, { params: { id: validUuid } })

      expect(mockWriteAudit).not.toHaveBeenCalled()
    })
  })
})
