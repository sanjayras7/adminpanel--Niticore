import { v4 as uuidv4 } from 'uuid'
import { sequelize } from '@/lib/sequelize'

export interface AuditEventInput {
  actor_internal_user_id: string
  actor_role: string | null
  action: string
  target_type: string
  target_id: string
  organization_id?: string | null
  lead_id?: string | null
  before_values?: Record<string, unknown> | null
  after_values?: Record<string, unknown> | null
  reason?: string | null
  ip_address?: string
  user_agent?: string
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await sequelize.query(
      `INSERT INTO internal_audit_events
        (id, actor_internal_user_id, actor_role, action, target_type, target_id,
         organization_id, lead_id, before_values, after_values, reason, ip_address, user_agent, created_at)
       VALUES
        (:id, :actor_internal_user_id, :actor_role, :action, :target_type, :target_id,
         :organization_id, :lead_id, :before_values::jsonb, :after_values::jsonb, :reason, :ip_address, :user_agent, NOW())`,
      {
        replacements: {
          id: uuidv4(),
          actor_internal_user_id: input.actor_internal_user_id,
          actor_role: input.actor_role,
          action: input.action,
          target_type: input.target_type,
          target_id: input.target_id,
          organization_id: input.organization_id ?? null,
          lead_id: input.lead_id ?? null,
          before_values: input.before_values ? JSON.stringify(input.before_values) : null,
          after_values: input.after_values ? JSON.stringify(input.after_values) : null,
          reason: input.reason ?? null,
          ip_address: input.ip_address ?? null,
          user_agent: input.user_agent ?? null,
        },
      },
    )
  } catch (err) {
    console.error('[AUDIT] Failed to write audit event:', err)
  }
}
