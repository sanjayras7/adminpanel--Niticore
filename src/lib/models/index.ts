import { InternalUser } from './InternalUser'
import { MagicLink } from './MagicLink'
import { InternalRole } from './InternalRole'
import { Framework } from './Framework'
import { FrameworkClassification } from './FrameworkClassification'
import { FrameworkVersion } from './FrameworkVersion'
import { FrameworkSection } from './FrameworkSection'
import { FrameworkClause } from './FrameworkClause'
import { Organization } from './Organization'
import { OrganizationModuleConfig } from './OrganizationModuleConfig'
import { Module } from './Module'
import { LegalDocument } from './LegalDocument'

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

Organization.hasMany(OrganizationModuleConfig, { foreignKey: 'organization_id', as: 'moduleConfigs' })
OrganizationModuleConfig.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' })
OrganizationModuleConfig.belongsTo(Module, { foreignKey: 'module_id', as: 'module' })
Module.hasMany(OrganizationModuleConfig, { foreignKey: 'module_id', as: 'orgConfigs' })

Organization.hasMany(LegalDocument, { foreignKey: 'organization_id', as: 'legalDocuments' })
LegalDocument.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' })

export {
  InternalUser,
  MagicLink,
  InternalRole,
  Framework,
  FrameworkClassification,
  FrameworkVersion,
  FrameworkSection,
  FrameworkClause,
  Organization,
  OrganizationModuleConfig,
  Module,
  LegalDocument,
}

export function initModels(): void {
  InternalUser
  MagicLink
  InternalRole
  Framework
  FrameworkClassification
  FrameworkVersion
  FrameworkSection
  FrameworkClause
  Organization
  OrganizationModuleConfig
  Module
  LegalDocument
}
