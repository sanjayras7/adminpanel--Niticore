export const EventTypes = {
  LEAD_CREATED: 'lead.created',
  NDA_SIGNED: 'nda.signed',
  CONTRACT_SIGNED: 'contract.signed',
  CONTRACT_DECLINED: 'contract.declined',
  CONTRACT_EXPIRED: 'contract.expired',
  PROVISIONING_FAILED: 'provisioning.failed',
  TENANT_READY_FOR_ACTIVATION: 'tenant.ready_for_activation',
  TOTP_RESET: 'totp.reset',
} as const

export interface TriggerEventPayload {
  organizationId?: string
  leadId?: string
  affectedUserId?: string
}
