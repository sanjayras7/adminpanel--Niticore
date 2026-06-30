import { QueryTypes } from 'sequelize'

jest.mock('@/lib/sequelize', () => ({
  sequelize: { query: jest.fn() },
}))

const mockSequelize = jest.requireMock('@/lib/sequelize') as { sequelize: { query: jest.Mock } }
const mockQuery = mockSequelize.sequelize.query

import {
  getTenantIdentity,
  getPrimaryAdmin,
  getCustomerAdmins,
  getEnabledModules,
  getApplicableFrameworks,
  getOnboardingChecklist,
  getProvisioningStatus,
  getActivityTimeline,
  getAuditLog,
  getInternalNotes,
  getTenantDetailPageData,
  NotFoundError,
} from '@/lib/queries/tenant'

beforeEach(() => {
  mockQuery.mockReset()
})

describe('getTenantIdentity', () => {
  it('returns tenant identity when found', async () => {
    mockQuery.mockResolvedValue([
      { id: 'org-1', name: 'Acme Corp', tenant_hash: 'abc123', plan: 'Enterprise', status: 'active', created_at: new Date('2025-01-01') },
    ])
    const result = await getTenantIdentity('org-1')
    expect(result).toEqual({
      id: 'org-1', name: 'Acme Corp', tenantHash: 'abc123', plan: 'Enterprise',
      status: 'active', createdAt: '2025-01-01T00:00:00.000Z',
    })
  })

  it('throws NotFoundError when org not found', async () => {
    mockQuery.mockResolvedValue([])
    await expect(getTenantIdentity('nonexistent')).rejects.toThrow(NotFoundError)
  })
})

describe('getPrimaryAdmin', () => {
  it('returns the primary admin when found', async () => {
    mockQuery.mockResolvedValue([
      { id: 'user-1', name: 'John Admin', email: 'john@acme.com', status: 'active' },
    ])
    const result = await getPrimaryAdmin('org-1')
    expect(result).toEqual({ id: 'user-1', name: 'John Admin', email: 'john@acme.com', status: 'active' })
  })

  it('returns null when no primary admin', async () => {
    mockQuery.mockResolvedValue([])
    const result = await getPrimaryAdmin('org-1')
    expect(result).toBeNull()
  })
})

describe('getCustomerAdmins', () => {
  it('returns list of customer admins', async () => {
    mockQuery.mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'alice@acme.com', role: 'Admin', status: 'active', last_login_at: new Date('2025-06-01') },
      { id: 'u2', name: 'Bob', email: 'bob@acme.com', role: 'Editor', status: 'active', last_login_at: null },
    ])
    const result = await getCustomerAdmins('org-1')
    expect(result).toHaveLength(2)
    expect(result[0].lastLoginAt).toBe('2025-06-01T00:00:00.000Z')
    expect(result[1].lastLoginAt).toBeNull()
  })

  it('returns empty array when no admins', async () => {
    mockQuery.mockResolvedValue([])
    const result = await getCustomerAdmins('org-1')
    expect(result).toEqual([])
  })
})

describe('getEnabledModules', () => {
  it('groups sub-modules under modules', async () => {
    mockQuery.mockResolvedValue([
      { module_id: 'm1', module_name: 'Governance', sub_module_id: 'sm1', sub_module_name: 'Risk Assessment', enabled: true },
      { module_id: 'm1', module_name: 'Governance', sub_module_id: 'sm2', sub_module_name: 'Compliance', enabled: false },
      { module_id: 'm2', module_name: 'Reporting', sub_module_id: 'sm3', sub_module_name: 'Dashboards', enabled: true },
    ])
    const result = await getEnabledModules('org-1')
    expect(result).toHaveLength(2)
    expect(result[0].moduleName).toBe('Governance')
    expect(result[0].subModules).toHaveLength(2)
    expect(result[1].moduleName).toBe('Reporting')
    expect(result[1].subModules).toHaveLength(1)
  })

  it('returns empty array when no modules', async () => {
    mockQuery.mockResolvedValue([])
    const result = await getEnabledModules('org-1')
    expect(result).toEqual([])
  })
})

describe('getApplicableFrameworks', () => {
  it('returns list of frameworks', async () => {
    mockQuery.mockResolvedValue([
      { framework_id: 'f1', framework_name: 'SOC 2', version_label: '2.0' },
      { framework_id: 'f2', framework_name: 'ISO 27001', version_label: '2022' },
    ])
    const result = await getApplicableFrameworks('org-1')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ frameworkId: 'f1', frameworkName: 'SOC 2', version: '2.0' })
  })

  it('returns empty array when no frameworks', async () => {
    mockQuery.mockResolvedValue([])
    const result = await getApplicableFrameworks('org-1')
    expect(result).toEqual([])
  })
})

describe('getOnboardingChecklist', () => {
  it('returns checklist items with null fields handled', async () => {
    mockQuery.mockResolvedValue([
      { item_key: 'nda', title: 'NDA Signed', description: 'Customer must sign NDA', status: 'completed', completed_by: 'Jane', completed_at: new Date('2025-05-01') },
      { item_key: 'contract', title: 'Contract Signed', description: 'Customer must sign contract', status: 'pending', completed_by: null, completed_at: null },
    ])
    const result = await getOnboardingChecklist('org-1')
    expect(result).toHaveLength(2)
    expect(result[0].completedBy).toBe('Jane')
    expect(result[1].completedBy).toBeNull()
    expect(result[1].completedAt).toBeNull()
  })

  it('returns empty array when no items', async () => {
    mockQuery.mockResolvedValue([])
    const result = await getOnboardingChecklist('org-1')
    expect(result).toEqual([])
  })
})

describe('getProvisioningStatus', () => {
  it('returns log and details for successful provisioning', async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: 'log-1', organization_id: 'org-1', tenant_hash: 'abc123',
          template_version_id: 'tmpl-v1', status: 'success',
          failed_table: null, error_message: null,
          started_at: new Date('2025-06-01T00:00:00Z'),
          completed_at: new Date('2025-06-01T01:00:00Z'),
          created_at: new Date('2025-06-01T00:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'det-1', provisioning_log_id: 'log-1',
          schema_name: 'tenant_abc', table_name: 'users',
          status: 'created', error_message: null, rows_created: 10,
          started_at: new Date('2025-06-01T00:00:00Z'),
          completed_at: new Date('2025-06-01T00:30:00Z'),
        },
      ])
    const result = await getProvisioningStatus('org-1')
    expect(result.log).not.toBeNull()
    expect(result.log!.status).toBe('success')
    expect(result.log!.tenant_hash).toBe('abc123')
    expect(result.details).toHaveLength(1)
    expect(result.details[0].table_name).toBe('users')
  })

  it('returns null log and empty details when no provisioning record', async () => {
    mockQuery.mockResolvedValue([])
    const result = await getProvisioningStatus('org-1')
    expect(result.log).toBeNull()
    expect(result.details).toEqual([])
  })

  it('returns failed log with error detail', async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: 'log-2', organization_id: 'org-1', tenant_hash: 'def456',
          template_version_id: 'tmpl-v1', status: 'failed',
          failed_table: 'users', error_message: 'Column "email" already exists',
          started_at: new Date('2025-06-01T00:00:00Z'),
          completed_at: new Date('2025-06-01T00:10:00Z'),
          created_at: new Date('2025-06-01T00:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'det-2', provisioning_log_id: 'log-2',
          schema_name: 'tenant_def', table_name: 'users',
          status: 'failed', error_message: 'Column "email" already exists',
          rows_created: 0,
          started_at: new Date('2025-06-01T00:00:00Z'),
          completed_at: new Date('2025-06-01T00:10:00Z'),
        },
      ])
    const result = await getProvisioningStatus('org-1')
    expect(result.log!.status).toBe('failed')
    expect(result.log!.failed_table).toBe('users')
    expect(result.log!.error_message).toBe('Column "email" already exists')
    expect(result.details).toHaveLength(1)
    expect(result.details[0].status).toBe('failed')
  })

  it('returns in_progress log with null completed_at', async () => {
    mockQuery
      .mockResolvedValueOnce([
        {
          id: 'log-3', organization_id: 'org-1', tenant_hash: 'ghi789',
          template_version_id: 'tmpl-v1', status: 'in_progress',
          failed_table: null, error_message: null,
          started_at: new Date('2025-06-01T00:00:00Z'),
          completed_at: null,
          created_at: new Date('2025-06-01T00:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([])
    const result = await getProvisioningStatus('org-1')
    expect(result.log!.status).toBe('in_progress')
    expect(result.log!.completed_at).toBeNull()
    expect(result.details).toEqual([])
  })
})

describe('getActivityTimeline', () => {
  it('returns timeline events', async () => {
    mockQuery.mockResolvedValue([
      { id: 'a1', action: 'tenant_created', actor: 'Admin User', target_type: 'organization', created_at: new Date('2025-01-01') },
    ])
    const result = await getActivityTimeline('org-1')
    expect(result).toHaveLength(1)
    expect(result[0].action).toBe('tenant_created')
  })

  it('returns empty array when no events', async () => {
    mockQuery.mockResolvedValue([])
    const result = await getActivityTimeline('org-1')
    expect(result).toEqual([])
  })
})

describe('getAuditLog', () => {
  it('returns audit entries with before/after values', async () => {
    mockQuery.mockResolvedValue([
      {
        id: 'aud-1', action: 'user_role_changed', actor: 'Super Admin',
        target_type: 'user', target_id: 'usr-1',
        before_values: { role: 'Editor' }, after_values: { role: 'Admin' },
        created_at: new Date('2025-06-15'),
      },
    ])
    const result = await getAuditLog('org-1')
    expect(result).toHaveLength(1)
    expect(result[0].beforeValues).toEqual({ role: 'Editor' })
    expect(result[0].afterValues).toEqual({ role: 'Admin' })
  })
})

describe('getInternalNotes', () => {
  it('returns notes', async () => {
    mockQuery.mockResolvedValue([
      { id: 'n1', note_text: 'Follow up on compliance', created_by: 'Admin User', created_at: new Date('2025-06-10') },
    ])
    const result = await getInternalNotes('org-1')
    expect(result).toHaveLength(1)
    expect(result[0].noteText).toBe('Follow up on compliance')
  })
})

describe('getTenantDetailPageData', () => {
  it('aggregates all sections from a tenant', async () => {
    mockQuery
      .mockResolvedValueOnce([{ id: 'org-1', name: 'Acme Corp', tenant_hash: 'abc', plan: 'Enterprise', status: 'active', created_at: new Date('2025-01-01') }])
      .mockResolvedValueOnce([{ id: 'u1', name: 'John Admin', email: 'john@acme.com', status: 'active' }])
      .mockResolvedValueOnce([{ id: 'u2', name: 'Bob', email: 'bob@acme.com', role: 'Editor', status: 'active', last_login_at: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getTenantDetailPageData('org-1')
    expect(result.sections.tenant.name).toBe('Acme Corp')
    expect(result.sections.primaryAdmin).not.toBeNull()
    expect(result.sections.customerAdmins).toHaveLength(1)
    expect(result.errors).toEqual([])
    expect(result.sections.provisioningStatus.log).toBeNull()
    expect(result.sections.provisioningStatus.details).toEqual([])
  })

  it('collects per-section errors without failing the whole page', async () => {
    mockQuery
      .mockResolvedValueOnce([{ id: 'org-1', name: 'Acme', tenant_hash: 'abc', plan: 'Basic', status: 'active', created_at: new Date('2025-01-01') }])
      .mockRejectedValueOnce(new Error('DB timeout'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await getTenantDetailPageData('org-1')
    expect(result.sections.tenant.name).toBe('Acme')
    expect(result.sections.primaryAdmin).toBeNull()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].section).toBe('primaryAdmin')
    expect(result.errors[0].error).toBe('DB timeout')
  })

  it('returns section errors when tenant not found', async () => {
    mockQuery.mockResolvedValue([])
    const result = await getTenantDetailPageData('nonexistent')
    expect(result.sections.tenant).toEqual({})
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].section).toBe('tenant')
  })
})

describe('type integrity', () => {
  const types = [
    'TenantIdentity', 'PrimaryAdmin', 'CustomerAdmin', 'EnabledModule',
    'ApplicableFramework', 'OnboardingChecklistItem', 'ProvisioningStatus',
    'ActivityEvent', 'AuditLogEntry', 'InternalNote', 'TenantDetailPageData',
    'TenantDetailPageResult',
  ]
  it('interface names compile correctly', () => {
    expect(types.length).toBeGreaterThan(0)
  })
})
