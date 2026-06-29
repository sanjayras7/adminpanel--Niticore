// TODO: Replace this stub with Issue 13a's live module list source.
// The hardcoded list below matches the 15 modules from the architecture skill.

export interface ModuleDefinition {
  id: string
  name: string
  description: string
  key: string
}

const HARDCODED_MODULES: ModuleDefinition[] = [
  { id: 'mod-auth-mfa',       name: 'Auth + MFA',                    description: 'Authentication and multi-factor authentication', key: 'auth_mfa' },
  { id: 'mod-rbac',           name: 'RBAC',                          description: 'Role-based access control', key: 'rbac' },
  { id: 'mod-shell-nav',      name: 'Shell/Nav',                     description: 'Application shell and navigation', key: 'shell_nav' },
  { id: 'mod-lead-crm',       name: 'Lead/CRM',                      description: 'Lead and CRM management', key: 'lead_crm' },
  { id: 'mod-nda-contract',   name: 'NDA/Contract',                  description: 'NDA and contract management', key: 'nda_contract' },
  { id: 'mod-esign',          name: 'E-Sign Adapter',                description: 'Electronic signature integration', key: 'esign' },
  { id: 'mod-doc-storage',    name: 'Document Storage',              description: 'Secure document storage', key: 'doc_storage' },
  { id: 'mod-onboarding-wiz', name: 'Onboarding Wizard',            description: 'Tenant onboarding wizard', key: 'onboarding_wizard' },
  { id: 'mod-provisioning',   name: 'Provisioning Monitoring',       description: 'Tenant provisioning and monitoring', key: 'provisioning' },
  { id: 'mod-tenant-ops',     name: 'Tenant Detail/Ops',             description: 'Tenant operations and details', key: 'tenant_ops' },
  { id: 'mod-support',        name: 'Support/Impersonation',         description: 'Customer support and impersonation', key: 'support' },
  { id: 'mod-framework-mgmt', name: 'Framework/Controls Mgmt',       description: 'Framework and controls management', key: 'framework_mgmt' },
  { id: 'mod-tenant-config',  name: 'Tenant Framework Config',       description: 'Tenant framework configuration', key: 'tenant_config' },
  { id: 'mod-audit',          name: 'Audit/Timeline',               description: 'Audit logging and timeline', key: 'audit' },
  { id: 'mod-notifications',  name: 'Notifications',                 description: 'Notification system', key: 'notifications' },
]

export function getModules(): ModuleDefinition[] {
  return HARDCODED_MODULES
}

export function getModuleById(id: string): ModuleDefinition | undefined {
  return HARDCODED_MODULES.find(m => m.id === id)
}

export function getModuleIds(): string[] {
  return HARDCODED_MODULES.map(m => m.id)
}

export function getPlanDefaultModuleIds(): string[] {
  // All 15 modules enabled by default for now.
  // TODO: Replace with actual plan-based logic from Issue 13a.
  return HARDCODED_MODULES.map(m => m.id)
}
