import { InternalUser } from './InternalUser'
import { InternalRole } from './InternalRole'
import { MagicLink } from './MagicLink'
import { Framework } from './Framework'
import { FrameworkClassification } from './FrameworkClassification'
import { FrameworkVersion } from './FrameworkVersion'
import { FrameworkSection } from './FrameworkSection'
import { FrameworkClause } from './FrameworkClause'
import { InternalAuditEvent } from './InternalAuditEvent'
import { InternalSession } from './InternalSession'
import { Lead } from './Lead'
import { LeadNote } from './LeadNote'
import { Notification } from './Notification'
import { initNotificationDispatcher } from '@/lib/notifications'
import { LegalDocument } from './LegalDocument'
export { isValidTransition, isValidStatus, type ContractPlatformStatus } from './LegalDocument'
import { OrganizationAdminInvite } from './OrganizationAdminInvite'
import { Module } from './Module'
import { OrganizationModuleConfig } from './OrganizationModuleConfig'
import { OrganizationFrameworkSelection } from './OrganizationFrameworkSelection'
import { OrganizationIntegrationIntent } from './OrganizationIntegrationIntent'
import { WizardState } from './WizardState'
import { Control } from './Control'
import { ControlVersion } from './ControlVersion'
import { ControlImplementationStep } from './ControlImplementationStep'
import { ControlStepCategory } from './ControlStepCategory'
import { ControlEvidenceType } from './ControlEvidenceType'
import { GateOverride } from './GateOverride'
import { Organization } from './Organization'
import { TenantProvisioningLog } from './TenantProvisioningLog'
import { TenantProvisioningDetail } from './TenantProvisioningDetail'
import { ControlFrameworkMapping } from './ControlFrameworkMapping'
import { ControlRiskMapping } from './ControlRiskMapping'

InternalRole.hasMany(InternalUser, { foreignKey: 'internal_role_id', as: 'users' })

Control.hasMany(ControlVersion, { foreignKey: 'control_id', as: 'versions' })
ControlVersion.belongsTo(Control, { foreignKey: 'control_id', as: 'control' })
ControlVersion.hasMany(ControlImplementationStep, { foreignKey: 'control_version_id', as: 'implementationSteps' })
ControlImplementationStep.belongsTo(ControlVersion, { foreignKey: 'control_version_id', as: 'version' })
ControlVersion.hasMany(ControlEvidenceType, { foreignKey: 'control_version_id', as: 'evidenceTypes' })
ControlEvidenceType.belongsTo(ControlVersion, { foreignKey: 'control_version_id', as: 'version' })
ControlImplementationStep.belongsTo(ControlStepCategory, { foreignKey: 'category_id', as: 'category' })
ControlStepCategory.hasMany(ControlImplementationStep, { foreignKey: 'category_id', as: 'steps' })
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

Organization.hasMany(LegalDocument, { foreignKey: 'organization_id', as: 'legalDocuments' })
LegalDocument.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' })

TenantProvisioningLog.hasMany(TenantProvisioningDetail, { foreignKey: 'provisioning_log_id', as: 'details' })
TenantProvisioningDetail.belongsTo(TenantProvisioningLog, { foreignKey: 'provisioning_log_id', as: 'log' })

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
  Control,
  ControlVersion,
  ControlImplementationStep,
  ControlStepCategory,
  ControlEvidenceType,
  Framework,
  FrameworkClassification,
  FrameworkVersion,
  FrameworkSection,
  FrameworkClause,
  GateOverride,
  Organization,
  TenantProvisioningLog,
  TenantProvisioningDetail,
  ControlFrameworkMapping,
  ControlRiskMapping,
}

export function initModels(): void {
  InternalUser
  MagicLink
  InternalRole
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
  Control
  ControlVersion
  ControlImplementationStep
  ControlStepCategory
  ControlEvidenceType
  Framework
  FrameworkClassification
  FrameworkVersion
  FrameworkSection
  FrameworkClause
  GateOverride
  Organization
  TenantProvisioningLog
  TenantProvisioningDetail
  ControlFrameworkMapping
  ControlRiskMapping
}
