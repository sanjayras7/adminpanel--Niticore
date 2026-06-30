import { sequelize } from '@/lib/sequelize'
import { QueryTypes } from 'sequelize'

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

export interface TenantIdentity {
  id: string
  name: string
  tenantHash: string
  plan: string
  status: string
  createdAt: string
}

export interface PrimaryAdmin {
  id: string
  name: string
  email: string
  status: string
}

export interface CustomerAdmin {
  id: string
  name: string
  email: string
  role: string
  status: string
  lastLoginAt: string | null
}

export interface SubModule {
  id: string
  name: string
  enabled: boolean
}

export interface EnabledModule {
  moduleId: string
  moduleName: string
  subModules: SubModule[]
}

export interface ApplicableFramework {
  frameworkId: string
  frameworkName: string
  version: string
}

export interface OnboardingChecklistItem {
  itemKey: string
  title: string
  description: string
  status: string
  completedBy: string | null
  completedAt: string | null
}

export interface ProvisioningDetail {
  id: string
  provisioning_log_id: string
  schema_name: string
  table_name: string
  status: 'created' | 'skipped' | 'failed'
  error_message: string | null
  rows_created: number
  started_at: string
  completed_at: string | null
}

export interface ProvisioningLogInfo {
  id: string
  organization_id: string
  tenant_hash: string
  template_version_id: string
  status: 'success' | 'failed' | 'in_progress'
  failed_table: string | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface ProvisioningStatus {
  log: ProvisioningLogInfo | null
  details: ProvisioningDetail[]
}

export interface ActivityEvent {
  id: string
  action: string
  actor: string
  targetType: string
  createdAt: string
}

export interface AuditLogEntry {
  id: string
  action: string
  actor: string
  targetType: string
  targetId: string
  beforeValues: Record<string, unknown> | null
  afterValues: Record<string, unknown> | null
  createdAt: string
}

export interface InternalNote {
  id: string
  noteText: string
  createdBy: string
  createdAt: string
}

export interface TenantDetailPageData {
  tenant: TenantIdentity
  primaryAdmin: PrimaryAdmin | null
  customerAdmins: CustomerAdmin[]
  enabledModules: EnabledModule[]
  applicableFrameworks: ApplicableFramework[]
  onboardingChecklist: OnboardingChecklistItem[]
  provisioningStatus: ProvisioningStatus
  integrationHealth: unknown
  activityTimeline: ActivityEvent[]
  auditLog: AuditLogEntry[]
  internalNotes: InternalNote[]
}

interface SectionError {
  section: string
  error: string
}

export interface TenantDetailPageResult {
  sections: TenantDetailPageData
  errors: SectionError[]
}

async function runQuery<T>(query: string, replacements?: Record<string, unknown>): Promise<T[]> {
  return sequelize.query(query, {
    type: QueryTypes.SELECT,
    replacements,
  }) as Promise<T[]>
}

export async function getTenantIdentity(organizationId: string): Promise<TenantIdentity> {
  const rows = await runQuery<{
    id: string; name: string; tenant_hash: string; plan: string; status: string; created_at: Date
  }>(
    `SELECT id, name, tenant_hash, plan, status, created_at FROM organizations WHERE id = :id AND deleted_at IS NULL`,
    { id: organizationId },
  )
  if (rows.length === 0) {
    throw new NotFoundError(`Organization ${organizationId} not found`)
  }
  const row = rows[0]
  return {
    id: row.id,
    name: row.name,
    tenantHash: row.tenant_hash,
    plan: row.plan,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  }
}

export async function getPrimaryAdmin(organizationId: string): Promise<PrimaryAdmin | null> {
  const rows = await runQuery<{
    id: string; name: string; email: string; status: string
  }>(
    `SELECT ou.id, ou.name, ou.email, ou.status
     FROM organization_users ou
     WHERE ou.organization_id = :orgId AND ou.role = 'Admin'
     ORDER BY ou.created_at ASC LIMIT 1`,
    { orgId: organizationId },
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return { id: row.id, name: row.name, email: row.email, status: row.status }
}

export async function getCustomerAdmins(organizationId: string): Promise<CustomerAdmin[]> {
  const rows = await runQuery<{
    id: string; name: string; email: string; role: string; status: string; last_login_at: Date | null
  }>(
    `SELECT ou.id, ou.name, ou.email, ou.role, ou.status, ou.last_login_at
     FROM organization_users ou
     WHERE ou.organization_id = :orgId AND ou.role IN ('Admin', 'Reviewer', 'Editor', 'Auditor')
     ORDER BY ou.created_at ASC`,
    { orgId: organizationId },
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    status: r.status,
    lastLoginAt: r.last_login_at ? r.last_login_at.toISOString() : null,
  }))
}

export async function getEnabledModules(organizationId: string): Promise<EnabledModule[]> {
  const rows = await runQuery<{
    module_id: string; module_name: string; sub_module_id: string; sub_module_name: string; enabled: boolean
  }>(
    `SELECT m.id AS module_id, m.name AS module_name,
            sm.id AS sub_module_id, sm.name AS sub_module_name,
            COALESCE(omc.enabled, false) AS enabled
     FROM modules m
     JOIN sub_modules sm ON sm.module_id = m.id
     LEFT JOIN organization_module_config omc
       ON omc.module_id = m.id AND omc.sub_module_id = sm.id AND omc.organization_id = :orgId
     WHERE m.deleted_at IS NULL AND sm.deleted_at IS NULL
     ORDER BY m.sort_order, sm.sort_order`,
    { orgId: organizationId },
  )
  const moduleMap = new Map<string, EnabledModule>()
  for (const r of rows) {
    if (!moduleMap.has(r.module_id)) {
      moduleMap.set(r.module_id, { moduleId: r.module_id, moduleName: r.module_name, subModules: [] })
    }
    moduleMap.get(r.module_id)!.subModules.push({
      id: r.sub_module_id,
      name: r.sub_module_name,
      enabled: r.enabled,
    })
  }
  return Array.from(moduleMap.values())
}

export async function getApplicableFrameworks(organizationId: string): Promise<ApplicableFramework[]> {
  const rows = await runQuery<{
    framework_id: string; framework_name: string; version_label: string
  }>(
    `SELECT f.id AS framework_id, f.name AS framework_name, fv.version_label
     FROM organization_frameworks of
     JOIN frameworks f ON f.id = of.framework_id
     JOIN framework_versions fv ON fv.id = of.framework_version_id
     WHERE of.organization_id = :orgId AND f.deleted_at IS NULL
     ORDER BY f.name ASC`,
    { orgId: organizationId },
  )
  return rows.map((r) => ({
    frameworkId: r.framework_id,
    frameworkName: r.framework_name,
    version: r.version_label,
  }))
}

export async function getOnboardingChecklist(organizationId: string): Promise<OnboardingChecklistItem[]> {
  const rows = await runQuery<{
    item_key: string; title: string; description: string; status: string;
    completed_by: string | null; completed_at: Date | null
  }>(
    `SELECT oci.item_key, oci.title, oci.description, oci.status,
            oci.completed_by, oci.completed_at
     FROM onboarding_checklist_items oci
     WHERE oci.organization_id = :orgId
     ORDER BY oci.sort_order ASC`,
    { orgId: organizationId },
  )
  return rows.map((r) => ({
    itemKey: r.item_key,
    title: r.title,
    description: r.description,
    status: r.status,
    completedBy: r.completed_by,
    completedAt: r.completed_at ? r.completed_at.toISOString() : null,
  }))
}

export async function getProvisioningStatus(organizationId: string): Promise<ProvisioningStatus> {
  const logRows = await runQuery<{
    id: string; organization_id: string; tenant_hash: string; template_version_id: string;
    status: string; failed_table: string | null; error_message: string | null;
    started_at: Date; completed_at: Date | null; created_at: Date
  }>(
    `SELECT id, organization_id, tenant_hash, template_version_id,
            status, failed_table, error_message,
            started_at, completed_at, created_at
     FROM tenant_provisioning_log
     WHERE organization_id = :orgId
     ORDER BY created_at DESC LIMIT 1`,
    { orgId: organizationId },
  )

  const log = logRows.length > 0
    ? {
        id: logRows[0].id,
        organization_id: logRows[0].organization_id,
        tenant_hash: logRows[0].tenant_hash,
        template_version_id: logRows[0].template_version_id,
        status: logRows[0].status as ProvisioningLogInfo['status'],
        failed_table: logRows[0].failed_table,
        error_message: logRows[0].error_message,
        started_at: logRows[0].started_at.toISOString(),
        completed_at: logRows[0].completed_at ? logRows[0].completed_at.toISOString() : null,
        created_at: logRows[0].created_at.toISOString(),
      }
    : null

  let details: ProvisioningDetail[] = []
  if (log) {
    const detailRows = await runQuery<{
      id: string; provisioning_log_id: string; schema_name: string; table_name: string;
      status: string; error_message: string | null; rows_created: number;
      started_at: Date; completed_at: Date | null
    }>(
      `SELECT id, provisioning_log_id, schema_name, table_name,
              status, error_message, rows_created,
              started_at, completed_at
       FROM tenant_provisioning_details
       WHERE provisioning_log_id = :logId
       ORDER BY started_at ASC`,
      { logId: log.id },
    )
    details = detailRows.map((r) => ({
      id: r.id,
      provisioning_log_id: r.provisioning_log_id,
      schema_name: r.schema_name,
      table_name: r.table_name,
      status: r.status as ProvisioningDetail['status'],
      error_message: r.error_message,
      rows_created: r.rows_created,
      started_at: r.started_at.toISOString(),
      completed_at: r.completed_at ? r.completed_at.toISOString() : null,
    }))
  }

  return { log, details }
}

export async function getIntegrationHealth(): Promise<unknown> {
  return null
}

export async function getActivityTimeline(organizationId: string): Promise<ActivityEvent[]> {
  const rows = await runQuery<{
    id: string; action: string; actor: string; target_type: string; created_at: Date
  }>(
    `SELECT iae.id, iae.action,
            COALESCE(iu.name || ' ' || iu.surname, iae.actor_internal_user_id) AS actor,
            iae.target_type, iae.created_at
     FROM internal_audit_events iae
     LEFT JOIN internal_users iu ON iu.id = iae.actor_internal_user_id
     WHERE iae.organization_id = :orgId
     ORDER BY iae.created_at DESC LIMIT 100`,
    { orgId: organizationId },
  )
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actor: r.actor,
    targetType: r.target_type,
    createdAt: r.created_at.toISOString(),
  }))
}

export async function getAuditLog(organizationId: string): Promise<AuditLogEntry[]> {
  const rows = await runQuery<{
    id: string; action: string; actor: string; target_type: string; target_id: string;
    before_values: Record<string, unknown> | null; after_values: Record<string, unknown> | null;
    created_at: Date
  }>(
    `SELECT iae.id, iae.action,
            COALESCE(iu.name || ' ' || iu.surname, iae.actor_internal_user_id) AS actor,
            iae.target_type, iae.target_id, iae.before_values, iae.after_values, iae.created_at
     FROM internal_audit_events iae
     LEFT JOIN internal_users iu ON iu.id = iae.actor_internal_user_id
     WHERE iae.organization_id = :orgId
     ORDER BY iae.created_at DESC LIMIT 200`,
    { orgId: organizationId },
  )
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actor: r.actor,
    targetType: r.target_type,
    targetId: r.target_id,
    beforeValues: r.before_values,
    afterValues: r.after_values,
    createdAt: r.created_at.toISOString(),
  }))
}

export async function getInternalNotes(organizationId: string): Promise<InternalNote[]> {
  const rows = await runQuery<{
    id: string; note_text: string; created_by: string; created_at: Date
  }>(
    `SELECT tin.id, tin.note_text,
            COALESCE(iu.name || ' ' || iu.surname, tin.created_by) AS created_by,
            tin.created_at
     FROM tenant_internal_notes tin
     LEFT JOIN internal_users iu ON iu.id = tin.created_by
     WHERE tin.organization_id = :orgId AND tin.deleted_at IS NULL
     ORDER BY tin.created_at DESC LIMIT 100`,
    { orgId: organizationId },
  )
  return rows.map((r) => ({
    id: r.id,
    noteText: r.note_text,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
  }))
}

export async function getTenantDetailPageData(organizationId: string): Promise<TenantDetailPageResult> {
  const errors: SectionError[] = []

  const safeFetch = async <T>(
    section: string,
    fn: () => Promise<T>,
    defaultValue: T,
  ): Promise<T> => {
    try {
      return await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ section, error: message })
      return defaultValue
    }
  }

  const tenant = await safeFetch(
    'tenant',
    () => getTenantIdentity(organizationId),
    null as unknown as TenantIdentity,
  )
  if (!tenant) {
    return {
      sections: {
        tenant: {} as TenantIdentity,
        primaryAdmin: null,
        customerAdmins: [],
        enabledModules: [],
        applicableFrameworks: [],
        onboardingChecklist: [],
        provisioningStatus: { log: null, details: [] },
        integrationHealth: null,
        activityTimeline: [],
        auditLog: [],
        internalNotes: [],
      },
      errors,
    }
  }

  const [
    primaryAdmin,
    customerAdmins,
    enabledModules,
    applicableFrameworks,
    onboardingChecklist,
    provisioningStatus,
    integrationHealth,
    activityTimeline,
    auditLog,
    internalNotes,
  ] = await Promise.all([
    safeFetch('primaryAdmin', () => getPrimaryAdmin(organizationId), null),
    safeFetch('customerAdmins', () => getCustomerAdmins(organizationId), []),
    safeFetch('enabledModules', () => getEnabledModules(organizationId), []),
    safeFetch('applicableFrameworks', () => getApplicableFrameworks(organizationId), []),
    safeFetch('onboardingChecklist', () => getOnboardingChecklist(organizationId), []),
    safeFetch('provisioningStatus', () => getProvisioningStatus(organizationId), { log: null, details: [] }),
    safeFetch('integrationHealth', () => getIntegrationHealth(), null),
    safeFetch('activityTimeline', () => getActivityTimeline(organizationId), []),
    safeFetch('auditLog', () => getAuditLog(organizationId), []),
    safeFetch('internalNotes', () => getInternalNotes(organizationId), []),
  ])

  return {
    sections: {
      tenant,
      primaryAdmin,
      customerAdmins,
      enabledModules,
      applicableFrameworks,
      onboardingChecklist,
      provisioningStatus,
      integrationHealth,
      activityTimeline,
      auditLog,
      internalNotes,
    },
    errors,
  }
}
