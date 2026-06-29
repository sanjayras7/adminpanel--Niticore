import {
  validateCustomerProfile,
  validatePlanLifecycle,
  validateStep,
  processServerValidationResponse,
} from '@/lib/validation/wizard'
import { CustomerProfileData, PlanLifecycleData } from '@/lib/wizard/types'

describe('validateCustomerProfile', () => {
  const validData: CustomerProfileData = {
    tenantName: 'Acme Corp',
    slug: 'acme-corp',
    domain: 'acme.com',
    region: 'us-east-1',
    ownerId: '123e4567-e89b-12d3-a456-426614174000',
    notes: 'A test customer',
  }

  it('returns no errors for valid data', () => {
    const errors = validateCustomerProfile(validData)
    expect(errors).toEqual({})
  })

  it('returns no errors for valid data without optional notes', () => {
    const { notes, ...rest } = validData
    const errors = validateCustomerProfile(rest)
    expect(errors).toEqual({})
  })

  it('requires tenantName', () => {
    const errors = validateCustomerProfile({ ...validData, tenantName: '' })
    expect(errors.tenantName).toBe('Tenant name is required')
  })

  it('rejects tenantName longer than 255 characters', () => {
    const errors = validateCustomerProfile({ ...validData, tenantName: 'a'.repeat(256) })
    expect(errors.tenantName).toBe('Tenant name must be 255 characters or less')
  })

  it('requires slug', () => {
    const errors = validateCustomerProfile({ ...validData, slug: '' })
    expect(errors.slug).toBe('Slug is required')
  })

  it('validates slug format (URL-safe)', () => {
    const errors = validateCustomerProfile({ ...validData, slug: 'Invalid Slug!' })
    expect(errors.slug).toBe('Slug must be lowercase alphanumeric with hyphens only (e.g., acme-corp)')
  })

  it('rejects slug over 63 characters', () => {
    const errors = validateCustomerProfile({ ...validData, slug: 'a'.repeat(64) })
    expect(errors.slug).toBe('Slug must be 63 characters or less')
  })

  it('requires domain', () => {
    const errors = validateCustomerProfile({ ...validData, domain: '' })
    expect(errors.domain).toBe('Domain is required')
  })

  it('validates domain format', () => {
    const errors = validateCustomerProfile({ ...validData, domain: 'not-a-domain' })
    expect(errors.domain).toBe('Please enter a valid domain (e.g., example.com)')
  })

  it('requires region', () => {
    const errors = validateCustomerProfile({ ...validData, region: '' })
    expect(errors.region).toBe('Region is required')
  })

  it('requires ownerId', () => {
    const errors = validateCustomerProfile({ ...validData, ownerId: '' })
    expect(errors.ownerId).toBe('Owner is required')
  })

  it('rejects notes over 2000 characters', () => {
    const errors = validateCustomerProfile({ ...validData, notes: 'a'.repeat(2001) })
    expect(errors.notes).toBe('Notes must be 2000 characters or less')
  })

  it('allows notes exactly at 2000 characters', () => {
    const errors = validateCustomerProfile({ ...validData, notes: 'a'.repeat(2000) })
    expect(errors.notes).toBeUndefined()
  })

  it('returns multiple errors for multiple missing fields', () => {
    const errors = validateCustomerProfile({} as CustomerProfileData)
    expect(errors.tenantName).toBe('Tenant name is required')
    expect(errors.slug).toBe('Slug is required')
    expect(errors.domain).toBe('Domain is required')
    expect(errors.region).toBe('Region is required')
    expect(errors.ownerId).toBe('Owner is required')
  })
})

describe('validatePlanLifecycle', () => {
  const validData: PlanLifecycleData = {
    plan: 'enterprise',
    billingRef: 'PO-12345',
    contractStart: '2026-07-01',
    contractEnd: '2027-06-30',
    initialStatus: 'draft',
  }

  it('returns no errors for valid data', () => {
    const errors = validatePlanLifecycle(validData)
    expect(errors).toEqual({})
  })

  it('returns no errors for valid data without optional billingRef', () => {
    const { billingRef, ...rest } = validData
    const errors = validatePlanLifecycle(rest)
    expect(errors).toEqual({})
  })

  it('requires plan', () => {
    const errors = validatePlanLifecycle({ ...validData, plan: '' })
    expect(errors.plan).toBe('Plan is required')
  })

  it('requires contractStart', () => {
    const errors = validatePlanLifecycle({ ...validData, contractStart: '' })
    expect(errors.contractStart).toBe('Contract start date is required')
  })

  it('validates contractStart is a date', () => {
    const errors = validatePlanLifecycle({ ...validData, contractStart: 'not-a-date' })
    expect(errors.contractStart).toBe('Contract start must be a valid date (YYYY-MM-DD)')
  })

  it('requires contractEnd', () => {
    const errors = validatePlanLifecycle({ ...validData, contractEnd: '' })
    expect(errors.contractEnd).toBe('Contract end date is required')
  })

  it('validates contractEnd is a date', () => {
    const errors = validatePlanLifecycle({ ...validData, contractEnd: 'not-a-date' })
    expect(errors.contractEnd).toBe('Contract end must be a valid date (YYYY-MM-DD)')
  })

  it('rejects contractEnd before contractStart', () => {
    const errors = validatePlanLifecycle({ ...validData, contractStart: '2027-01-01', contractEnd: '2026-12-31' })
    expect(errors.contractEnd).toBe('Contract end date must be on or after contract start date')
  })

  it('allows contractEnd equal to contractStart', () => {
    const errors = validatePlanLifecycle({ ...validData, contractStart: '2026-07-01', contractEnd: '2026-07-01' })
    expect(errors.contractEnd).toBeUndefined()
  })

  it('requires initialStatus', () => {
    const errors = validatePlanLifecycle({ ...validData, initialStatus: '' })
    expect(errors.initialStatus).toBe('Initial status is required')
  })
})

describe('validateStep', () => {
  it('routes to validateCustomerProfile for step 1', () => {
    const errors = validateStep(1, {} as CustomerProfileData)
    expect(errors.tenantName).toBe('Tenant name is required')
  })

  it('routes to validatePlanLifecycle for step 2', () => {
    const errors = validateStep(2, {} as PlanLifecycleData)
    expect(errors.plan).toBe('Plan is required')
  })

  it('returns empty for unknown step', () => {
    const errors = validateStep(999, {})
    expect(errors).toEqual({})
  })
})

describe('processServerValidationResponse', () => {
  it('sets domain warnings for already-registered messages', () => {
    const result = processServerValidationResponse({
      domain: 'This domain is already registered. Another tenant may be using it.',
    })
    expect(result.warnings.domain).toBeDefined()
    expect(result.errors.domain).toBeUndefined()
  })

  it('puts non-domain errors in errors', () => {
    const result = processServerValidationResponse({ slug: 'This slug is taken' })
    expect(result.errors.slug).toBeDefined()
    expect(Object.keys(result.warnings)).toHaveLength(0)
  })

  it('returns empty for empty input', () => {
    const result = processServerValidationResponse({})
    expect(Object.keys(result.errors)).toHaveLength(0)
    expect(Object.keys(result.warnings)).toHaveLength(0)
  })
})