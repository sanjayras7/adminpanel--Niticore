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
import { Framework } from './Framework'
import { FrameworkClassification } from './FrameworkClassification'
import { FrameworkVersion } from './FrameworkVersion'
import { FrameworkSection } from './FrameworkSection'
import { FrameworkClause } from './FrameworkClause'
import { WizardState } from './WizardState'

InternalUser.belongsTo(InternalRole, { foreignKey: 'internal_role_id', as: 'role' })
InternalRole.hasMany(InternalUser, { foreignKey: 'internal_role_id', as: 'users' })

Framework.hasMany(FrameworkVersion, { foreignKey: 'framework_id', as: 'versions' })
FrameworkVersion.belongsTo(Framework, { foreignKey: 'framework_id', as: 'framework' })

FrameworkVersion.hasMany(FrameworkSection, { foreignKey: 'framework_version_id', as: 'sections' })
FrameworkSection.belongsTo(FrameworkVersion, { foreignKey: 'framework_version_id', as: 'version' })

FrameworkSection.hasMany(FrameworkSection, { foreignKey: 'parent_section_id', as: 'childSections' })
FrameworkSection.belongsTo(FrameworkSection, { foreignKey: 'parent_section_id', as: 'parentSection' })

FrameworkSection.hasMany(FrameworkClause, { foreignKey: 'framework_section_id', as: 'clauses' })
FrameworkClause.belongsTo(FrameworkSection, { foreignKey: 'framework_section_id', as: 'section' })

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
  Framework,
  FrameworkClassification,
  FrameworkVersion,
  FrameworkSection,
  FrameworkClause,
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
  LegalDocument
  OrganizationAdminInvite
  Module
  OrganizationModuleConfig
  OrganizationFrameworkSelection
  OrganizationIntegrationIntent
  Framework
  FrameworkClassification
  FrameworkVersion
  FrameworkSection
  FrameworkClause
  WizardState
}
