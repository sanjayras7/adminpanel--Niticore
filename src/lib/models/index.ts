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
}
