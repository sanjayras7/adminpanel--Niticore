import { CustomerProfileData, PlanLifecycleData, ServerValidationError } from '@/lib/wizard/types'

const SLUG_REGEX = /^[a-z0-9-]+$/
const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z]{2,})+$/

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

export function validateStep(stepNumber: number, data: any): Record<string, string> {
  switch (stepNumber) {
    case 1:
      return validateCustomerProfile(data)
    case 2:
      return validatePlanLifecycle(data)
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