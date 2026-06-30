import { validateFrameworkSelection, validateIntegrationIntent, validateStep } from '@/lib/validation/wizard'

describe('validateFrameworkSelection', () => {
  const validData = {
    organization_id: 'org-1',
    framework_selections: [
      { framework_name: 'SOC 2', framework_version_name: '2023', control_ids: ['CC1.1', 'CC1.2'], risk_threshold: 'medium' },
    ],
  }

  it('returns no errors for valid framework selection data', () => {
    const errors = validateFrameworkSelection(validData)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns error when organization_id is missing', () => {
    const errors = validateFrameworkSelection({ ...validData, organization_id: '' })
    expect(errors.organization_id).toBe('Organization ID is required')
  })

  it('returns error when framework_selections is not an array', () => {
    const errors = validateFrameworkSelection({ ...validData, framework_selections: null })
    expect(errors.framework_selections).toBe('Framework selections must be an array')
  })

  it('returns no error for empty selections array', () => {
    const errors = validateFrameworkSelection({ ...validData, framework_selections: [] })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns error for invalid risk_threshold', () => {
    const errors = validateFrameworkSelection({
      ...validData,
      framework_selections: [{ ...validData.framework_selections[0], risk_threshold: 'extreme' }],
    })
    expect(errors['framework_selections[0].risk_threshold']).toContain('Invalid risk threshold')
    expect(errors['framework_selections[0].risk_threshold']).toContain('low')
    expect(errors['framework_selections[0].risk_threshold']).toContain('critical')
  })

  it('accepts valid risk thresholds', () => {
    for (const threshold of ['low', 'medium', 'high', 'critical', 'all']) {
      const errors = validateFrameworkSelection({
        ...validData,
        framework_selections: [{ ...validData.framework_selections[0], risk_threshold: threshold }],
      })
      expect(errors['framework_selections[0].risk_threshold']).toBeUndefined()
    }
  })

  it('accepts null control_ids', () => {
    const errors = validateFrameworkSelection({
      ...validData,
      framework_selections: [{ ...validData.framework_selections[0], control_ids: null }],
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('accepts null framework_id and framework_version_id', () => {
    const errors = validateFrameworkSelection({
      ...validData,
      framework_selections: [{ ...validData.framework_selections[0], framework_id: null, framework_version_id: null }],
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })
})

describe('validateIntegrationIntent', () => {
  const validData = {
    organization_id: 'org-1',
    domain: 'tenant.example.com',
    sso_required: false,
    sso_provider: null,
    notes: null,
  }

  it('returns no errors for valid integration intent data', () => {
    const errors = validateIntegrationIntent(validData)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('returns error when organization_id is missing', () => {
    const errors = validateIntegrationIntent({ ...validData, organization_id: '' })
    expect(errors.organization_id).toBe('Organization ID is required')
  })

  it('returns error when domain exceeds 255 characters', () => {
    const errors = validateIntegrationIntent({ ...validData, domain: 'a'.repeat(256) })
    expect(errors.domain).toBe('Domain must be 255 characters or less')
  })

  it('returns error when sso_provider exceeds 100 characters', () => {
    const errors = validateIntegrationIntent({ ...validData, sso_required: true, sso_provider: 'a'.repeat(101) })
    expect(errors.sso_provider).toBe('SSO provider must be 100 characters or less')
  })

  it('accepts null domain', () => {
    const errors = validateIntegrationIntent({ ...validData, domain: null })
    expect(errors.domain).toBeUndefined()
  })

  it('accepts empty domain string', () => {
    const errors = validateIntegrationIntent({ ...validData, domain: '' })
    expect(errors.domain).toBeUndefined()
  })

  it('accepts undefined domain', () => {
    const errors = validateIntegrationIntent({ ...validData, domain: undefined })
    expect(errors.domain).toBeUndefined()
  })

  it('accepts null sso_provider when sso_required is true', () => {
    const errors = validateIntegrationIntent({ ...validData, sso_required: true, sso_provider: null })
    expect(errors.sso_provider).toBeUndefined()
  })

  it('accepts empty notes', () => {
    const errors = validateIntegrationIntent({ ...validData, notes: '' })
    expect(Object.keys(errors)).toHaveLength(0)
  })
})

describe('validateStep routing', () => {
  it('routes step 5 to validateFrameworkSelection', () => {
    const errors = validateStep(5, { organization_id: '' })
    expect(errors.organization_id).toBe('Organization ID is required')
  })

  it('routes step 6 to validateIntegrationIntent', () => {
    const errors = validateStep(6, { organization_id: '' })
    expect(errors.organization_id).toBe('Organization ID is required')
  })

  it('returns empty errors for unknown step', () => {
    const errors = validateStep(99, {})
    expect(Object.keys(errors)).toHaveLength(0)
  })
})

describe('FrameworkStepData contract shape', () => {
  it('accepts the full framework selection shape', () => {
    const data = {
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      framework_selections: [
        {
          framework_id: '550e8400-e29b-41d4-a716-446655440001',
          framework_version_id: '550e8400-e29b-41d4-a716-446655440002',
          control_ids: ['CTRL-1', 'CTRL-2'],
          risk_threshold: 'high',
        },
      ],
    }
    const errors = validateFrameworkSelection(data)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('coexists with stub data shape (framework_name instead of framework_id)', () => {
    const data = {
      organization_id: 'org-stub-1',
      framework_selections: [
        {
          framework_name: 'SOC 2',
          framework_version_name: '2023',
          control_ids: null,
          risk_threshold: 'medium',
        },
      ],
    }
    const errors = validateFrameworkSelection(data)
    expect(Object.keys(errors)).toHaveLength(0)
  })
})

describe('IntegrationIntentData contract shape', () => {
  it('accepts minimal intent data', () => {
    const data = {
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
    }
    const errors = validateIntegrationIntent(data)
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('accepts full intent with all fields', () => {
    const data = {
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      domain: 'tenant.niticore.com',
      sso_required: true,
      sso_provider: 'Okta',
      notes: 'Use existing Okta tenant with SCIM provisioning',
    }
    const errors = validateIntegrationIntent(data)
    expect(Object.keys(errors)).toHaveLength(0)
  })
})
