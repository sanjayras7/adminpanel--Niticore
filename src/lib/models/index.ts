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
import { Control } from './Control'
import { ControlVersion } from './ControlVersion'
import { ControlImplementationStep } from './ControlImplementationStep'
import { ControlStepCategory } from './ControlStepCategory'
import { ControlEvidenceType } from './ControlEvidenceType'

InternalUser.belongsTo(InternalRole, { foreignKey: 'internal_role_id', as: 'role' })
InternalRole.hasMany(InternalUser, { foreignKey: 'internal_role_id', as: 'users' })

Control.hasMany(ControlVersion, { foreignKey: 'control_id', as: 'versions' })
ControlVersion.belongsTo(Control, { foreignKey: 'control_id', as: 'control' })
ControlVersion.hasMany(ControlImplementationStep, { foreignKey: 'control_version_id', as: 'implementationSteps' })
ControlImplementationStep.belongsTo(ControlVersion, { foreignKey: 'control_version_id', as: 'version' })
ControlVersion.hasMany(ControlEvidenceType, { foreignKey: 'control_version_id', as: 'evidenceTypes' })
ControlEvidenceType.belongsTo(ControlVersion, { foreignKey: 'control_version_id', as: 'version' })
ControlImplementationStep.belongsTo(ControlStepCategory, { foreignKey: 'category_id', as: 'category' })
ControlStepCategory.hasMany(ControlImplementationStep, { foreignKey: 'category_id', as: 'steps' })

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
  Control
  ControlVersion
  ControlImplementationStep
  ControlStepCategory
  ControlEvidenceType
}
