export type NotificationChannel = 'in_app' | 'email'

export interface NotificationEvent {
  type: string
  organization_id?: string | null
  lead_id?: string | null
  target_owner_id?: string | null
  target_role?: string | null
  title: string
  body: string
  metadata?: Record<string, unknown>
}

export interface NotificationRecord {
  id: string
  recipient_id: string
  organization_id?: string | null
  lead_id?: string | null
  title: string
  body: string
  channel: NotificationChannel
  read_at: string | null
  created_at: string
  metadata?: Record<string, unknown>
}
