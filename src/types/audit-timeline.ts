export interface AuditTimelineActor {
  id: string
  role: string
}

export interface AuditTimelineTarget {
  type: string
  id: string
}

export interface AuditTimelineEvent {
  id: string
  actor: AuditTimelineActor
  action: string
  description: string
  target: AuditTimelineTarget | null
  organizationId: string | null
  leadId: string | null
  beforeValues: Record<string, unknown> | null
  afterValues: Record<string, unknown> | null
  reason: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface AuditTimelineResponse {
  events: AuditTimelineEvent[]
  nextCursor: string | null
}

export interface AuditTimelineError {
  error: string
  message: string
}
