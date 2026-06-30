import { CustomerProfileData, PlanLifecycleData, AdminRequestBody, FrameworkStepData, IntegrationIntentData } from '@/lib/wizard/types'

const SLUG_REGEX = /^[a-z0-9-]+$/
const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z]{2,})+$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const VALID_RISK_THRESHOLDS = ['low', 'medium', 'high', 'critical', 'all']

export function validateCustomerProfile(data: CustomerProfileData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.tenantName || data.tenantName.trim().length === 0) {
    errors.tenantName = 'Tenant name is required'
  } else if (data.tenantName.length > 255) {
    errors.tenantName = 'Tenant name must be 255 characters or less'
  }

  if (!data.slug || data.slug.trim().length === 0) {
    errors.slug = 'Slug is required'
  } else if (!SLUG_REGEX.test(data.slug)) {
    errors.slug = 'Slug must be lowercase alphanumeric with hyphens only (e.g., acme-corp)'
  } else if (data.slug.length > 63) {
    errors.slug = 'Slug must be 63 characters or less'
  }

  if (!data.domain || data.domain.trim().length === 0) {
    errors.domain = 'Domain is required'
  } else if (!DOMAIN_REGEX.test(data.domain)) {
    errors.domain = 'Please enter a valid domain (e.g., example.com)'
  }

  if (!data.region || data.region.trim().length === 0) {
    errors.region = 'Region is required'
  }

  if (!data.ownerId || data.ownerId.trim().length === 0) {
    errors.ownerId = 'Owner is required'
  } else if (!UUID_REGEX.test(data.ownerId)) {
    errors.ownerId = 'Invalid owner ID format'
  }

  if (data.notes && data.notes.length > 2000) {
    errors.notes = 'Notes must be 2000 characters or less'
  }

  return errors
}

export function validatePlanLifecycle(data: PlanLifecycleData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.plan || data.plan.trim().length === 0) {
    errors.plan = 'Plan is required'
  }

  if (!data.contractStart || data.contractStart.trim().length === 0) {
    errors.contractStart = 'Contract start date is required'
  } else if (!isValidISODate(data.contractStart)) {
    errors.contractStart = 'Contract start must be a valid date (YYYY-MM-DD)'
  }

  if (!data.contractEnd || data.contractEnd.trim().length === 0) {
    errors.contractEnd = 'Contract end date is required'
  } else if (!isValidISODate(data.contractEnd)) {
    errors.contractEnd = 'Contract end must be a valid date (YYYY-MM-DD)'
  } else if (data.contractStart && data.contractEnd) {
    const start = new Date(data.contractStart)
    const end = new Date(data.contractEnd)
    if (end < start) {
      errors.contractEnd = 'Contract end date must be on or after contract start date'
    }
  }

  if (!data.initialStatus || data.initialStatus.trim().length === 0) {
    errors.initialStatus = 'Initial status is required'
  }

  return errors
}

function isValidISODate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

export function validateFrameworkSelection(data: FrameworkStepData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.organization_id || data.organization_id.trim().length === 0) {
    errors.organization_id = 'Organization ID is required'
  }

  if (!Array.isArray(data.framework_selections)) {
    errors.framework_selections = 'Framework selections must be an array'
    return errors
  }

  for (let i = 0; i < data.framework_selections.length; i++) {
    const sel = data.framework_selections[i]
    const prefix = `framework_selections[${i}]`

    if (sel.risk_threshold && !VALID_RISK_THRESHOLDS.includes(sel.risk_threshold)) {
      errors[`${prefix}.risk_threshold`] = `Invalid risk threshold "${sel.risk_threshold}". Must be one of: ${VALID_RISK_THRESHOLDS.join(', ')}`
    }
  }

  return errors
}

export function validateIntegrationIntent(data: IntegrationIntentData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.organization_id || data.organization_id.trim().length === 0) {
    errors.organization_id = 'Organization ID is required'
  }

  if (data.domain !== undefined && data.domain !== null && data.domain.length > 255) {
    errors.domain = 'Domain must be 255 characters or less'
  }

  if (data.sso_provider !== undefined && data.sso_provider !== null && data.sso_provider.length > 100) {
    errors.sso_provider = 'SSO provider must be 100 characters or less'
  }

  return errors
}

export function validateAdminInvite(data: AdminRequestBody): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'First name is required'
  } else if (data.name.length > 255) {
    errors.name = 'First name must be 255 characters or less'
  }

  if (!data.surname || data.surname.trim().length === 0) {
    errors.surname = 'Last name is required'
  } else if (data.surname.length > 255) {
    errors.surname = 'Last name must be 255 characters or less'
  }

  if (!data.email || data.email.trim().length === 0) {
    errors.email = 'Email is required'
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address'
  }

  if (data.job_title && data.job_title.length > 255) {
    errors.job_title = 'Job title must be 255 characters or less'
  }

  if (
    data.invite_timing &&
    data.invite_timing !== 'send_now' &&
    data.invite_timing !== 'defer'
  ) {
    errors.invite_timing = 'Invite timing must be "send_now" or "defer"'
  }

  return errors
}

export function validateModuleSelection(data: {
  organization_id?: string
  modules?: Array<{ moduleId: string; enabled: boolean }>
}): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!Array.isArray(data.modules) || data.modules.length === 0) {
    errors.modules = 'At least one module must be selected'
    return errors
  }

  const enabledCount = data.modules.filter((m) => m.enabled).length
  if (enabledCount === 0) {
    errors.modules = 'At least one module must be enabled'
  }

  return errors
}

export function validateStep(stepNumber: number, data: any): Record<string, string> {
  switch (stepNumber) {
    case 1:
      return validateCustomerProfile(data)
    case 2:
      return validatePlanLifecycle(data)
    case 3:
      return validateAdminInvite(data)
    case 4:
      return validateModuleSelection(data)
    case 5:
      return validateFrameworkSelection(data)
    case 6:
      return validateIntegrationIntent(data)
    default:
      return {}
  }
}

export function processServerValidationResponse(
  serverErrors: Record<string, string>
): { errors: Record<string, string>; warnings: Record<string, string> } {
  const errors: Record<string, string> = {}
  const warnings: Record<string, string> = {}

  for (const [field, message] of Object.entries(serverErrors)) {
    if (field === 'domain' && message.toLowerCase().includes('already')) {
      warnings[field] = message
    } else {
      errors[field] = message
    }
  }

  return { errors, warnings }
}