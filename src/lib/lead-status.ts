export const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Engaged',
  'Negotiation',
  'Converted_to_Tenant',
  'Disqualified',
  'Archived',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  New: ['Contacted', 'Disqualified', 'Archived'],
  Contacted: ['Engaged', 'Disqualified', 'Archived'],
  Engaged: ['Negotiation', 'Disqualified', 'Archived'],
  Negotiation: ['Converted_to_Tenant', 'Disqualified', 'Archived'],
  Converted_to_Tenant: [],
  Disqualified: ['Archived'],
  Archived: [],
}

const TERMINAL_STATUSES: Set<LeadStatus> = new Set(['Converted_to_Tenant', 'Archived'])

export function isValidStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value)
}

export function getAllowedNextStatuses(current: LeadStatus): LeadStatus[] {
  return ALLOWED_TRANSITIONS[current]
}

export function isTerminalStatus(status: LeadStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

export function isSameStatus(current: LeadStatus, next: LeadStatus): boolean {
  return current === next
}

export function validateTransition(current: LeadStatus, next: LeadStatus): { valid: boolean; allowedNext: LeadStatus[] } {
  if (isSameStatus(current, next)) {
    return { valid: true, allowedNext: ALLOWED_TRANSITIONS[current] }
  }
  const allowed = ALLOWED_TRANSITIONS[current]
  if (!allowed) {
    return { valid: false, allowedNext: [] }
  }
  return { valid: allowed.includes(next), allowedNext: allowed }
}
