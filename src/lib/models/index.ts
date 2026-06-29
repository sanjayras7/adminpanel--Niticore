import { InternalUser } from './InternalUser'
import { InternalRole } from './InternalRole'
import { MagicLink } from './MagicLink'
import { InternalAuditEvent } from './InternalAuditEvent'
import { InternalSession } from './InternalSession'
import { Lead } from './Lead'
import { LeadNote } from './LeadNote'
import { Notification } from './Notification'
import { initNotificationDispatcher } from '@/lib/notifications'

InternalUser.belongsTo(InternalRole, { foreignKey: 'internal_role_id', as: 'role' })
InternalRole.hasMany(InternalUser, { foreignKey: 'internal_role_id', as: 'users' })

export {
  InternalUser,
  InternalRole,
  MagicLink,
  InternalAuditEvent,
  InternalSession,
  Lead,
  LeadNote,
  Notification,
}

export function initModels(): void {
  InternalUser
  InternalRole
  MagicLink
  InternalAuditEvent
  InternalSession
  Lead
  LeadNote
  Notification

  if (process.env.NODE_ENV !== 'test') {
    initNotificationDispatcher()
  }
}
