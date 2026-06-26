const mockCreate = jest.fn()

jest.mock('@/lib/models/InternalAuditEvent', () => ({
  InternalAuditEvent: {
    create: mockCreate,
  },
}))

beforeEach(() => {
  mockCreate.mockClear()
})

describe('logAuditEvent', () => {
  let logAuditEvent: typeof import('@/lib/audit').logAuditEvent
  let AuditValidationError: typeof import('@/lib/audit').AuditValidationError
  let AuditReasonRequiredError: typeof import('@/lib/audit').AuditReasonRequiredError

  beforeAll(async () => {
    const mod = await import('@/lib/audit')
    logAuditEvent = mod.logAuditEvent
    AuditValidationError = mod.AuditValidationError
    AuditReasonRequiredError = mod.AuditReasonRequiredError
  })

  const validInput = {
    actorInternalUserId: '550e8400-e29b-41d4-a716-446655440000',
    actorRole: 'Super Admin',
    action: 'lead.created',
    targetType: 'lead',
    targetId: '660e8400-e29b-41d4-a716-446655440001',
  }

  it('successfully logs an audit event with all required fields', async () => {
    const createdRecord = {
      id: '770e8400-e29b-41d4-a716-446655440002',
      actor_internal_user_id: validInput.actorInternalUserId,
      actor_role: validInput.actorRole,
      action: validInput.action,
      target_type: validInput.targetType,
      target_id: validInput.targetId,
      organization_id: null,
      lead_id: null,
      before_values: null,
      after_values: null,
      reason: null,
      metadata: null,
      ip_address: null,
      user_agent: null,
      created_at: new Date('2026-06-25T12:00:00Z'),
    }
    mockCreate.mockResolvedValue(createdRecord)

    const result = await logAuditEvent(validInput)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(result.id).toBe(createdRecord.id)
    expect(result.actorInternalUserId).toBe(validInput.actorInternalUserId)
    expect(result.actorRole).toBe(validInput.actorRole)
    expect(result.action).toBe(validInput.action)
    expect(result.targetType).toBe(validInput.targetType)
    expect(result.targetId).toBe(validInput.targetId)
    expect(result.organizationId).toBeNull()
    expect(result.createdAt).toEqual(createdRecord.created_at)
  })

  it('persists all fields including optional ones', async () => {
    const input = {
      ...validInput,
      organizationId: 'org-uuid-001',
      leadId: 'lead-uuid-001',
      beforeValues: { status: 'pending' },
      afterValues: { status: 'active' },
      reason: 'Lead was qualified',
      metadata: { source: 'webform' },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    }
    const createdRecord = {
      id: '880e8400-e29b-41d4-a716-446655440003',
      actor_internal_user_id: input.actorInternalUserId,
      actor_role: input.actorRole,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      before_values: input.beforeValues,
      after_values: input.afterValues,
      reason: input.reason,
      metadata: input.metadata,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      created_at: new Date('2026-06-25T12:00:00Z'),
    }
    mockCreate.mockResolvedValue(createdRecord)

    const result = await logAuditEvent(input)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_internal_user_id: input.actorInternalUserId,
        actor_role: input.actorRole,
        organization_id: input.organizationId,
        lead_id: input.leadId,
        before_values: input.beforeValues,
        after_values: input.afterValues,
        reason: input.reason,
        metadata: input.metadata,
        ip_address: input.ipAddress,
        user_agent: input.userAgent,
      })
    )
    expect(result.organizationId).toBe('org-uuid-001')
    expect(result.leadId).toBe('lead-uuid-001')
    expect(result.reason).toBe('Lead was qualified')
    expect(result.ipAddress).toBe('192.168.1.1')
  })

  it('sets optional fields to null when not provided', async () => {
    mockCreate.mockResolvedValue({
      id: '990e8400-e29b-41d4-a716-446655440004',
      actor_internal_user_id: validInput.actorInternalUserId,
      actor_role: validInput.actorRole,
      action: validInput.action,
      target_type: validInput.targetType,
      target_id: validInput.targetId,
      organization_id: null,
      lead_id: null,
      before_values: null,
      after_values: null,
      reason: null,
      metadata: null,
      ip_address: null,
      user_agent: null,
      created_at: new Date(),
    })

    const result = await logAuditEvent(validInput)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: null,
        lead_id: null,
        before_values: null,
        after_values: null,
        reason: null,
        metadata: null,
        ip_address: null,
        user_agent: null,
      })
    )
    expect(result.organizationId).toBeNull()
  })
})

describe('logAuditEvent validation', () => {
  let logAuditEvent: typeof import('@/lib/audit').logAuditEvent
  let AuditValidationError: typeof import('@/lib/audit').AuditValidationError
  let AuditReasonRequiredError: typeof import('@/lib/audit').AuditReasonRequiredError

  beforeAll(async () => {
    const mod = await import('@/lib/audit')
    logAuditEvent = mod.logAuditEvent
    AuditValidationError = mod.AuditValidationError
    AuditReasonRequiredError = mod.AuditReasonRequiredError
  })

  const validInput = {
    actorInternalUserId: '550e8400-e29b-41d4-a716-446655440000',
    actorRole: 'Super Admin',
    action: 'lead.created',
    targetType: 'lead',
    targetId: '660e8400-e29b-41d4-a716-446655440001',
  }

  describe('actorInternalUserId validation', () => {
    it('throws AuditValidationError when actorInternalUserId is missing', async () => {
      const { actorInternalUserId, ...rest } = validInput
      await expect(logAuditEvent(rest as any)).rejects.toThrow(AuditValidationError)
    })

    it('throws when actorInternalUserId is empty string', async () => {
      await expect(logAuditEvent({ ...validInput, actorInternalUserId: '' })).rejects.toThrow(AuditValidationError)
    })

    it('throws when actorInternalUserId is whitespace', async () => {
      await expect(logAuditEvent({ ...validInput, actorInternalUserId: '   ' })).rejects.toThrow(AuditValidationError)
    })
  })

  describe('actorRole validation', () => {
    it('throws when actorRole is missing', async () => {
      const { actorRole, ...rest } = validInput
      await expect(logAuditEvent(rest as any)).rejects.toThrow(AuditValidationError)
    })

    it('throws when actorRole is empty string', async () => {
      await expect(logAuditEvent({ ...validInput, actorRole: '' })).rejects.toThrow(AuditValidationError)
    })

    it('throws when actorRole is whitespace', async () => {
      await expect(logAuditEvent({ ...validInput, actorRole: '   ' })).rejects.toThrow(AuditValidationError)
    })
  })

  describe('action validation', () => {
    it('throws when action is missing', async () => {
      const { action, ...rest } = validInput
      await expect(logAuditEvent(rest as any)).rejects.toThrow(AuditValidationError)
    })

    it('throws when action is empty string', async () => {
      await expect(logAuditEvent({ ...validInput, action: '' })).rejects.toThrow(AuditValidationError)
    })

    it('throws when action is whitespace', async () => {
      await expect(logAuditEvent({ ...validInput, action: '   ' })).rejects.toThrow(AuditValidationError)
    })
  })

  describe('targetType validation', () => {
    it('throws when targetType is missing', async () => {
      const { targetType, ...rest } = validInput
      await expect(logAuditEvent(rest as any)).rejects.toThrow(AuditValidationError)
    })

    it('throws when targetType is empty string', async () => {
      await expect(logAuditEvent({ ...validInput, targetType: '' })).rejects.toThrow(AuditValidationError)
    })

    it('throws when targetType is whitespace', async () => {
      await expect(logAuditEvent({ ...validInput, targetType: '   ' })).rejects.toThrow(AuditValidationError)
    })
  })

  describe('targetId validation', () => {
    it('throws when targetId is missing', async () => {
      const { targetId, ...rest } = validInput
      await expect(logAuditEvent(rest as any)).rejects.toThrow(AuditValidationError)
    })

    it('throws when targetId is empty string', async () => {
      await expect(logAuditEvent({ ...validInput, targetId: '' })).rejects.toThrow(AuditValidationError)
    })

    it('throws when targetId is whitespace', async () => {
      await expect(logAuditEvent({ ...validInput, targetId: '   ' })).rejects.toThrow(AuditValidationError)
    })
  })

  describe('validation does not persist when failing', () => {
    it('does not call create when validation fails', async () => {
      await expect(logAuditEvent({} as any)).rejects.toThrow()
      expect(mockCreate).not.toHaveBeenCalled()
    })
  })

  describe('requireReason', () => {
    it('throws AuditReasonRequiredError when requireReason is true but reason is missing', async () => {
      await expect(
        logAuditEvent(validInput, { requireReason: true })
      ).rejects.toThrow(AuditReasonRequiredError)
    })

    it('throws when requireReason is true but reason is empty string', async () => {
      await expect(
        logAuditEvent({ ...validInput, reason: '' }, { requireReason: true })
      ).rejects.toThrow(AuditReasonRequiredError)
    })

    it('throws when requireReason is true but reason is whitespace', async () => {
      await expect(
        logAuditEvent({ ...validInput, reason: '   ' }, { requireReason: true })
      ).rejects.toThrow(AuditReasonRequiredError)
    })

    it('succeeds when requireReason is true and reason is provided', async () => {
      mockCreate.mockResolvedValue({
        id: 'audit-001',
        actor_internal_user_id: validInput.actorInternalUserId,
        actor_role: validInput.actorRole,
        action: validInput.action,
        target_type: validInput.targetType,
        target_id: validInput.targetId,
        organization_id: null,
        lead_id: null,
        before_values: null,
        after_values: null,
        reason: 'Sensitive action requires reason',
        metadata: null,
        ip_address: null,
        user_agent: null,
        created_at: new Date(),
      })

      const result = await logAuditEvent(
        { ...validInput, reason: 'Sensitive action requires reason' },
        { requireReason: true }
      )
      expect(result.reason).toBe('Sensitive action requires reason')
    })

    it('succeeds when requireReason is false and reason is empty', async () => {
      mockCreate.mockResolvedValue({
        id: 'audit-002',
        actor_internal_user_id: validInput.actorInternalUserId,
        actor_role: validInput.actorRole,
        action: validInput.action,
        target_type: validInput.targetType,
        target_id: validInput.targetId,
        organization_id: null,
        lead_id: null,
        before_values: null,
        after_values: null,
        reason: null,
        metadata: null,
        ip_address: null,
        user_agent: null,
        created_at: new Date(),
      })

      const result = await logAuditEvent(validInput, { requireReason: false })
      expect(result.reason).toBeNull()
    })

    it('succeeds by default (requireReason not set) when reason is empty', async () => {
      mockCreate.mockResolvedValue({
        id: 'audit-003',
        actor_internal_user_id: validInput.actorInternalUserId,
        actor_role: validInput.actorRole,
        action: validInput.action,
        target_type: validInput.targetType,
        target_id: validInput.targetId,
        organization_id: null,
        lead_id: null,
        before_values: null,
        after_values: null,
        reason: null,
        metadata: null,
        ip_address: null,
        user_agent: null,
        created_at: new Date(),
      })

      const result = await logAuditEvent(validInput)
      expect(result.reason).toBeNull()
    })
  })
})

describe('audit module immutability', () => {
  it('does not export any update or delete functions', async () => {
    const mod = await import('@/lib/audit')
    const exportNames = Object.keys(mod)
    expect(exportNames).not.toContain('updateAuditEvent')
    expect(exportNames).not.toContain('deleteAuditEvent')
    expect(exportNames).not.toContain('update')
    expect(exportNames).not.toContain('delete')
    expect(exportNames).not.toContain('destroy')
  })
})

describe('Custom error classes', () => {
  it('AuditValidationError has correct name', async () => {
    const { AuditValidationError: ErrorClass } = await import('@/lib/audit')
    const err = new ErrorClass('test')
    expect(err.name).toBe('AuditValidationError')
    expect(err.message).toBe('test')
  })

  it('AuditReasonRequiredError has correct name', async () => {
    const { AuditReasonRequiredError: ErrorClass } = await import('@/lib/audit')
    const err = new ErrorClass('test')
    expect(err.name).toBe('AuditReasonRequiredError')
    expect(err.message).toBe('test')
  })
})
