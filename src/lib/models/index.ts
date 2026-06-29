import { InternalUser } from './InternalUser'
import { InternalRole } from './InternalRole'
import { MagicLink } from './MagicLink'
import { InternalAuditEvent } from './InternalAuditEvent'
import { InternalSession } from './InternalSession'
import { Lead } from './Lead'
import { LeadNote } from './LeadNote'
import { Notification } from './Notification'
import { initNotificationDispatcher } from '@/lib/notifications'
import { LegalDocument } from './LegalDocument'
import { OrganizationAdminInvite } from './OrganizationAdminInvite'
import { Module } from './Module'
import { OrganizationModuleConfig } from './OrganizationModuleConfig'
import { OrganizationFrameworkSelection } from './OrganizationFrameworkSelection'
import { OrganizationIntegrationIntent } from './OrganizationIntegrationIntent'
import { WizardState } from './WizardState'

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
  LegalDocument,
  OrganizationAdminInvite,
  Module,
  OrganizationModuleConfig,
  OrganizationFrameworkSelection,
  OrganizationIntegrationIntent,
  WizardState,
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
  LegalDocument
  OrganizationAdminInvite
  Module
  OrganizationModuleConfig
  OrganizationFrameworkSelection
  OrganizationIntegrationIntent
  WizardState
}
