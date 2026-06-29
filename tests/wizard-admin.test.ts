import { validateAdminBody } from '@/lib/validation'

describe('POST /api/v1/internal/onboarding/wizard/admin', () => {
  describe('validation - validateAdminBody', () => {
    const validBody = {
      organization_id: 'org-123',
      name: 'John',
      surname: 'Doe',
      email: 'john@example.com',
      job_title: 'CEO',
      invite_timing: 'send_now' as const,
    }

    it('passes validation with all required fields', () => {
      const errors = validateAdminBody(validBody)
      expect(Object.keys(errors)).toHaveLength(0)
    })

    it('passes validation without optional job_title', () => {
      const { job_title, ...body } = validBody
      const errors = validateAdminBody(body)
      expect(Object.keys(errors)).toHaveLength(0)
    })

    it('passes validation without invite_timing (defaults to defer)', () => {
      const { invite_timing, ...body } = validBody
      const errors = validateAdminBody(body)
      expect(Object.keys(errors)).toHaveLength(0)
    })

    it('rejects missing name', () => {
      const { name, ...body } = validBody
      const errors = validateAdminBody(body)
      expect(errors.name).toBe('required')
    })

    it('rejects empty name', () => {
      const errors = validateAdminBody({ ...validBody, name: '' })
      expect(errors.name).toBe('required')
    })

    it('rejects whitespace-only name', () => {
      const errors = validateAdminBody({ ...validBody, name: '   ' })
      expect(errors.name).toBe('required')
    })

    it('rejects missing surname', () => {
      const { surname, ...body } = validBody
      const errors = validateAdminBody(body)
      expect(errors.surname).toBe('required')
    })

    it('rejects empty surname', () => {
      const errors = validateAdminBody({ ...validBody, surname: '' })
      expect(errors.surname).toBe('required')
    })

    it('rejects missing email', () => {
      const { email, ...body } = validBody
      const errors = validateAdminBody(body)
      expect(errors.email).toBe('required')
    })

    it('rejects invalid email format', () => {
      const errors = validateAdminBody({ ...validBody, email: 'not-an-email' })
      expect(errors.email).toBe('invalid_format')
    })

    it('rejects email without domain', () => {
      const errors = validateAdminBody({ ...validBody, email: 'user@' })
      expect(errors.email).toBe('invalid_format')
    })

    it('rejects email without TLD', () => {
      const errors = validateAdminBody({ ...validBody, email: 'user@domain' })
      expect(errors.email).toBe('invalid_format')
    })

    it('rejects missing organization_id', () => {
      const { organization_id, ...body } = validBody
      const errors = validateAdminBody(body)
      expect(errors.organization_id).toBe('required')
    })

    it('rejects invalid invite_timing value', () => {
      const errors = validateAdminBody({
        ...validBody,
        invite_timing: 'invalid' as any,
      })
      expect(errors.invite_timing).toBe('invalid_value')
    })

    it('accepts send_now invite_timing', () => {
      const errors = validateAdminBody({ ...validBody, invite_timing: 'send_now' })
      expect(errors.invite_timing).toBeUndefined()
    })

    it('accepts defer invite_timing', () => {
      const errors = validateAdminBody({ ...validBody, invite_timing: 'defer' })
      expect(errors.invite_timing).toBeUndefined()
    })

    it('returns multiple field errors when several fields missing', () => {
      const errors = validateAdminBody({})
      expect(errors.name).toBe('required')
      expect(errors.surname).toBe('required')
      expect(errors.email).toBe('required')
      expect(errors.organization_id).toBe('required')
    })
  })

  describe('email uniqueness check', () => {
    // The route handler checks for existing user — unit-tested via DB mock in integration.
    // Validation layer does not check uniqueness (it's a DB concern).
    it('validation passes even with duplicate-looking email (uniqueness is checked in handler)', () => {
      const errors = validateAdminBody({
        organization_id: 'org-1',
        name: 'Jane',
        surname: 'Smith',
        email: 'existing@example.com',
      })
      expect(Object.keys(errors)).toHaveLength(0)
    })
  })
})
