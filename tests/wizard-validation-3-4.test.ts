import { validateAdminInvite, validateModuleSelection } from '@/lib/validation/wizard'

describe('validateAdminInvite (Step 3)', () => {
  it('passes with all required fields', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'Doe',
      email: 'john@example.com',
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('passes with optional fields', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'Doe',
      email: 'john@example.com',
      job_title: 'CEO',
      invite_timing: 'send_now',
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('rejects missing name', () => {
    const errors = validateAdminInvite({
      name: '',
      surname: 'Doe',
      email: 'john@example.com',
    })
    expect(errors.name).toBe('First name is required')
  })

  it('rejects whitespace-only name', () => {
    const errors = validateAdminInvite({
      name: '   ',
      surname: 'Doe',
      email: 'john@example.com',
    })
    expect(errors.name).toBe('First name is required')
  })

  it('rejects missing surname', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: '',
      email: 'john@example.com',
    })
    expect(errors.surname).toBe('Last name is required')
  })

  it('rejects missing email', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'Doe',
      email: '',
    })
    expect(errors.email).toBe('Email is required')
  })

  it('rejects invalid email format', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'Doe',
      email: 'not-an-email',
    })
    expect(errors.email).toBe('Please enter a valid email address')
  })

  it('rejects email without domain', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'Doe',
      email: 'user@',
    })
    expect(errors.email).toBe('Please enter a valid email address')
  })

  it('rejects email without TLD', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'Doe',
      email: 'user@domain',
    })
    expect(errors.email).toBe('Please enter a valid email address')
  })

  it('rejects invalid invite_timing', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'Doe',
      email: 'john@example.com',
      invite_timing: 'invalid_value' as any,
    })
    expect(errors.invite_timing).toBe('Invite timing must be "send_now" or "defer"')
  })

  it('accepts empty job_title', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'Doe',
      email: 'john@example.com',
      job_title: '',
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('rejects name exceeding 255 characters', () => {
    const errors = validateAdminInvite({
      name: 'a'.repeat(256),
      surname: 'Doe',
      email: 'john@example.com',
    })
    expect(errors.name).toBe('First name must be 255 characters or less')
  })

  it('rejects surname exceeding 255 characters', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'a'.repeat(256),
      email: 'john@example.com',
    })
    expect(errors.surname).toBe('Last name must be 255 characters or less')
  })

  it('rejects job_title exceeding 255 characters', () => {
    const errors = validateAdminInvite({
      name: 'John',
      surname: 'Doe',
      email: 'john@example.com',
      job_title: 'a'.repeat(256),
    })
    expect(errors.job_title).toBe('Job title must be 255 characters or less')
  })

  it('passes with exactly 255 characters in name', () => {
    const errors = validateAdminInvite({
      name: 'a'.repeat(255),
      surname: 'Doe',
      email: 'john@example.com',
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })
})

describe('validateModuleSelection (Step 4)', () => {
  it('passes with valid module selections', () => {
    const errors = validateModuleSelection({
      modules: [
        { moduleId: 'mod-auth-mfa', enabled: true },
        { moduleId: 'mod-rbac', enabled: false },
      ],
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('rejects missing modules array', () => {
    const errors = validateModuleSelection({})
    expect(errors.modules).toBe('At least one module must be selected')
  })

  it('rejects empty modules array', () => {
    const errors = validateModuleSelection({ modules: [] })
    expect(errors.modules).toBe('At least one module must be selected')
  })

  it('rejects when no modules are enabled', () => {
    const errors = validateModuleSelection({
      modules: [
        { moduleId: 'mod-auth-mfa', enabled: false },
        { moduleId: 'mod-rbac', enabled: false },
      ],
    })
    expect(errors.modules).toBe('At least one module must be enabled')
  })

  it('passes with at least one enabled module', () => {
    const errors = validateModuleSelection({
      modules: [
        { moduleId: 'mod-auth-mfa', enabled: true },
        { moduleId: 'mod-rbac', enabled: false },
        { moduleId: 'mod-shell-nav', enabled: false },
      ],
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('passes with all modules enabled', () => {
    const errors = validateModuleSelection({
      modules: Array.from({ length: 15 }, (_, i) => ({
        moduleId: `mod-${i}`,
        enabled: true,
      })),
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('passes with organization_id set', () => {
    const errors = validateModuleSelection({
      organization_id: 'org-123',
      modules: [{ moduleId: 'mod-auth-mfa', enabled: true }],
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })
})
