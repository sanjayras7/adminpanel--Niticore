export interface InternalAuditEvent {
  id: string
  actor_internal_user_id: string | null
  actor_role: string | null
  action: string
  target_type: string | null
  target_id: string | null
  organization_id: string | null
  lead_id: string | null
  before_values: Record<string, unknown> | null
  after_values: Record<string, unknown> | null
  reason: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

export type AuditEventTemplate = (event: InternalAuditEvent) => string

function truncate(value: string, max = 100): string {
  if (value.length <= max) return value
  return value.slice(0, max) + '\u2026'
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return 'unknown'
  if (typeof value === 'string') return truncate(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return truncate(JSON.stringify(value))
}

function getActorName(event: InternalAuditEvent): string {
  if (!event.actor_internal_user_id) return 'System'
  if (event.actor_role) return `${event.actor_internal_user_id} (${event.actor_role})`
  return event.actor_internal_user_id
}

function getTargetUserEmail(event: InternalAuditEvent): string {
  return safeString(event.metadata?.target_user_email ?? event.target_id)
}

function getBeforeValue(event: InternalAuditEvent, path: string): string {
  return safeString(event.before_values?.[path])
}

function getAfterValue(event: InternalAuditEvent, path: string): string {
  return safeString(event.after_values?.[path])
}

function getMetadata(event: InternalAuditEvent, path: string): string {
  return safeString(event.metadata?.[path])
}

export const AUDIT_EVENT_TEMPLATES: Record<string, AuditEventTemplate> = {
  login: (e) =>
    `${getActorName(e)} logged in from ${e.ip_address ?? 'unknown IP'}`,

  login_failed: (e) =>
    `Failed login attempt for ${safeString(e.target_id)} from ${e.ip_address ?? 'unknown IP'}`,

  logout: (e) =>
    `${getActorName(e)} logged out`,

  totp_enroll: (e) =>
    `${getActorName(e)} enrolled TOTP for ${getTargetUserEmail(e)}`,

  totp_reset: (e) =>
    `${getActorName(e)} reset TOTP for ${getTargetUserEmail(e)}`,

  role_changed: (e) =>
    `${getActorName(e)} changed role for ${getTargetUserEmail(e)} from ${getBeforeValue(e, 'role_name')} to ${getAfterValue(e, 'role_name')}`,

  internal_user_created: (e) =>
    `${getActorName(e)} created internal user ${getTargetUserEmail(e)}`,

  internal_user_deactivated: (e) =>
    `${getActorName(e)} deactivated internal user ${getTargetUserEmail(e)}`,

  lead_created: (e) =>
    `${getActorName(e)} created lead ${e.target_id}${getMetadata(e, 'company_name') !== 'unknown' ? ` (${getMetadata(e, 'company_name')})` : ''}`,

  lead_status_changed: (e) =>
    `${getActorName(e)} changed lead ${e.target_id} status from ${getBeforeValue(e, 'status')} to ${getAfterValue(e, 'status')}`,

  lead_assigned: (e) =>
    `${getActorName(e)} assigned lead ${e.target_id} to ${getMetadata(e, 'assigned_owner_name')}`,

  tenant_provisioned: (e) =>
    `${getActorName(e)} provisioned tenant ${e.target_id}${getMetadata(e, 'company_name') !== 'unknown' ? ` (${getMetadata(e, 'company_name')})` : ''}`,

  tenant_reprovisioned: (e) =>
    `${getActorName(e)} reprovisioned tenant ${e.target_id}`,

  tenant_deactivated: (e) =>
    `${getActorName(e)} deactivated tenant ${e.target_id}`,

  document_sent: (e) =>
    `${getActorName(e)} sent document ${e.target_id} (${getMetadata(e, 'document_type')}) to ${getMetadata(e, 'signer_email')}`,

  document_signed: (e) =>
    `${getActorName(e)} signed document ${e.target_id}${getMetadata(e, 'document_type') !== 'unknown' ? ` (${getMetadata(e, 'document_type')})` : ''}`,

  document_declined: (e) =>
    `${getActorName(e)} declined document ${e.target_id}${getMetadata(e, 'document_type') !== 'unknown' ? ` (${getMetadata(e, 'document_type')})` : ''}`,

  impersonation_started: (e) =>
    `${getActorName(e)} started impersonation session ${e.target_id} on organization ${e.organization_id} as user ${getMetadata(e, 'impersonated_user_email')}`,

  impersonation_ended: (e) =>
    `${getActorName(e)} ended impersonation session ${e.target_id}`,

  control_created: (e) =>
    `${getActorName(e)} created control ${e.target_id} (${getMetadata(e, 'control_code')})`,

  control_updated: (e) =>
    `${getActorName(e)} updated control ${e.target_id}`,

  control_deleted: (e) =>
    `${getActorName(e)} deleted control ${e.target_id}`,

  framework_created: (e) =>
    `${getActorName(e)} created framework ${e.target_id} (${getMetadata(e, 'framework_name')})`,

  framework_published: (e) =>
    `${getActorName(e)} published framework ${e.target_id}`,

  organization_module_configured: (e) =>
    `${getActorName(e)} configured module ${getMetadata(e, 'module_name')} for organization ${e.organization_id}`,

  gate_override: (e) =>
    `${getActorName(e)} overrode gate ${getMetadata(e, 'gate_type')} for ${e.target_type} ${e.target_id} (reason: ${e.reason ?? 'no reason given'})`,

  magic_link_sent: (e) =>
    `${getActorName(e)} sent magic link to ${safeString(e.target_id)}`,

  tenant_note_added: (e) =>
    `${getActorName(e)} added note to tenant ${e.organization_id}`,

  onboarding_checklist_updated: (e) =>
    `${getActorName(e)} updated onboarding checklist item ${getMetadata(e, 'item_key')} to ${getMetadata(e, 'new_status')}`,
}

export function formatAuditEvent(event: InternalAuditEvent): string {
  const template = AUDIT_EVENT_TEMPLATES[event.action]
  if (template) {
    return template(event)
  }

  const parts: string[] = [event.action]
  if (event.target_type) parts.push('on')
  if (event.target_type) parts.push(event.target_type)
  if (event.target_id) parts.push(event.target_id)
  return parts.join(' ')
}
