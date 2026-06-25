export type InternalRoleName =
  | 'Super Admin'
  | 'Implementation Manager'
  | 'Customer Success'
  | 'Support'
  | 'Finance/Admin'
  | 'Engineering'
  | 'Read-only Auditor'

export type ModuleName =
  | 'auth'
  | 'rbac'
  | 'shell'
  | 'leads'
  | 'nda-contracts'
  | 'e-sign'
  | 'document-storage'
  | 'onboarding'
  | 'provisioning-monitoring'
  | 'tenant-ops'
  | 'support-impersonation'
  | 'framework-controls'
  | 'tenant-framework-config'
  | 'audit'
  | 'notifications'

export type ActionName = 'create' | 'read' | 'update' | 'delete' | 'override' | 'impersonate' | 'audit'

type PermissionMatrix = Record<ModuleName, Partial<Record<ActionName, InternalRoleName[]>>>

const SA: InternalRoleName = 'Super Admin'
const IM: InternalRoleName = 'Implementation Manager'
const CS: InternalRoleName = 'Customer Success'
const SU: InternalRoleName = 'Support'
const FA: InternalRoleName = 'Finance/Admin'
const EN: InternalRoleName = 'Engineering'
const RA: InternalRoleName = 'Read-only Auditor'

const ALL_ROLES: InternalRoleName[] = [SA, IM, CS, SU, FA, EN, RA]

export const ALL_ROLE_NAMES: readonly InternalRoleName[] = ALL_ROLES

export const permissionMatrix: PermissionMatrix = {
  auth: {
    create: [SA],
    read: ALL_ROLES,
    update: [SA, IM, SU],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  rbac: {
    create: [SA],
    read: ALL_ROLES,
    update: [SA],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  shell: {
    create: [],
    read: ALL_ROLES,
    update: [],
    delete: [],
    override: [],
    impersonate: [],
    audit: [SA, RA],
  },
  leads: {
    create: [SA, IM, CS],
    read: [SA, IM, CS, SU, FA, EN, RA],
    update: [SA, IM, CS],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  'nda-contracts': {
    create: [SA, IM],
    read: [SA, IM, CS, SU, FA, RA],
    update: [SA, IM],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  'e-sign': {
    create: [SA, IM],
    read: [SA, IM, CS, SU, FA, RA],
    update: [SA, IM],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  'document-storage': {
    create: [SA, IM],
    read: [SA, IM, CS, SU, FA, RA],
    update: [SA, IM],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  onboarding: {
    create: [SA, IM, CS],
    read: [SA, IM, CS, SU, FA, EN, RA],
    update: [SA, IM, CS],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  'provisioning-monitoring': {
    create: [SA, EN],
    read: [SA, IM, CS, SU, FA, EN, RA],
    update: [SA, IM, EN],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  'tenant-ops': {
    create: [SA, IM],
    read: [SA, IM, CS, SU, FA, EN, RA],
    update: [SA, IM],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  'support-impersonation': {
    create: [],
    read: [SA, SU, RA],
    update: [],
    delete: [],
    override: [SA],
    impersonate: [SA, SU],
    audit: [SA, RA],
  },
  'framework-controls': {
    create: [SA],
    read: [SA, IM, CS, SU, EN, RA],
    update: [SA],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  'tenant-framework-config': {
    create: [SA, IM],
    read: [SA, IM, CS, SU, EN, RA],
    update: [SA, IM],
    delete: [SA],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  audit: {
    create: [SA, RA],
    read: ALL_ROLES,
    update: [],
    delete: [],
    override: [SA],
    impersonate: [],
    audit: [SA, RA],
  },
  notifications: {
    create: [SA, IM, CS],
    read: [SA, IM, CS, SU, FA, EN, RA],
    update: [SA, IM],
    delete: [SA],
    override: [],
    impersonate: [],
    audit: [SA, RA],
  },
}
