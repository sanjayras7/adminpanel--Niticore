import { InternalUser } from './InternalUser'
import { InternalRole } from './InternalRole'
import { MagicLink } from './MagicLink'
import { InternalAuditEvent } from './InternalAuditEvent'
import { InternalSession } from './InternalSession'
import { Lead } from './Lead'
import { LeadNote } from './LeadNote'
import { LegalDocument } from './LegalDocument'
import { OrganizationAdminInvite } from './OrganizationAdminInvite'
import { Module } from './Module'
import { OrganizationModuleConfig } from './OrganizationModuleConfig'
import { OrganizationFrameworkSelection } from './OrganizationFrameworkSelection'
import { OrganizationIntegrationIntent } from './OrganizationIntegrationIntent'

export {
  InternalUser,
  InternalRole,
  MagicLink,
  InternalAuditEvent,
  InternalSession,
  Lead,
  LeadNote,
  LegalDocument,
  OrganizationAdminInvite,
  Module,
  OrganizationModuleConfig,
  OrganizationFrameworkSelection,
  OrganizationIntegrationIntent,
}

export function initModels(): void {
  InternalUser
  InternalRole
  MagicLink
  InternalAuditEvent
  InternalSession
  Lead
  LeadNote
  LegalDocument
  OrganizationAdminInvite
  Module
  OrganizationModuleConfig
  OrganizationFrameworkSelection
  OrganizationIntegrationIntent
}
