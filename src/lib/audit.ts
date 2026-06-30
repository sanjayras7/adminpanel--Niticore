import { InternalAuditEvent } from '@/lib/models/InternalAuditEvent'

export class AuditValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuditValidationError'
  }
}

export class AuditReasonRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuditReasonRequiredError'
  }
}

export interface AuditEventInput {
  actorInternalUserId: string
  actorRole: string
  action: string
  targetType: string
  targetId: string
  organizationId?: string | null
  leadId?: string | null
  beforeValues?: Record<string, unknown> | null
  afterValues?: Record<string, unknown> | null
  reason?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AuditEventRecord {
  id: string
  actorInternalUserId: string
  actorRole: string
  action: string
  targetType: string
  targetId: string
  organizationId: string | null
  leadId: string | null
  beforeValues: Record<string, unknown> | null
  afterValues: Record<string, unknown> | null
  reason: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export interface LogAuditEventOptions {
  requireReason?: boolean
}

export async function logAuditEvent(
  input: AuditEventInput,
  options?: LogAuditEventOptions
): Promise<AuditEventRecord> {
  if (!input.actorInternalUserId || typeof input.actorInternalUserId !== 'string' || input.actorInternalUserId.trim() === '') {
    throw new AuditValidationError('actorInternalUserId is required and must be a non-empty string')
  }
  if (!input.actorRole || typeof input.actorRole !== 'string' || input.actorRole.trim() === '') {
    throw new AuditValidationError('actorRole is required and must be a non-empty string')
  }
  if (!input.action || typeof input.action !== 'string' || input.action.trim() === '') {
    throw new AuditValidationError('action is required and must be a non-empty string')
  }
  if (!input.targetType || typeof input.targetType !== 'string' || input.targetType.trim() === '') {
    throw new AuditValidationError('targetType is required and must be a non-empty string')
  }
  if (!input.targetId || typeof input.targetId !== 'string' || input.targetId.trim() === '') {
    throw new AuditValidationError('targetId is required and must be a non-empty string')
  }

  if (options?.requireReason) {
    const reason = input.reason ?? ''
    if (typeof reason !== 'string' || reason.trim() === '') {
      throw new AuditReasonRequiredError('reason is required for this audit event')
    }
  }

  const record = await InternalAuditEvent.create({
    actor_internal_user_id: input.actorInternalUserId,
    actor_role: input.actorRole,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    organization_id: input.organizationId ?? null,
    lead_id: input.leadId ?? null,
    before_values: input.beforeValues ?? null,
    after_values: input.afterValues ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? null,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    created_at: new Date(),
  })

  return {
    id: record.id,
    actorInternalUserId: record.actor_internal_user_id,
    actorRole: record.actor_role,
    action: record.action,
    targetType: record.target_type,
    targetId: record.target_id,
    organizationId: record.organization_id,
    leadId: record.lead_id,
    beforeValues: record.before_values as Record<string, unknown> | null,
    afterValues: record.after_values as Record<string, unknown> | null,
    reason: record.reason,
    metadata: record.metadata as Record<string, unknown> | null,
    ipAddress: record.ip_address,
    userAgent: record.user_agent,
    createdAt: record.created_at,
  }
}