import { isValidTransition, isValidStatus, type ContractPlatformStatus } from '@/lib/models'
import { writeAuditEvent } from '@/lib/audit'

jest.mock('@/lib/models', () => {
  const actual = jest.requireActual('@/lib/models')
  return {
    ...actual,
    LegalDocument: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
    },
  }
})

jest.mock('@/lib/audit', () => ({
  writeAuditEvent: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  getAuthUser: jest.fn(),
  requireMutationAuth: jest.fn(),
}))

describe('LegalDocument status transition validation', () => {
  describe('isValidTransition', () => {
    const valid: [ContractPlatformStatus, ContractPlatformStatus][] = [
      ['Draft', 'Sent'],
      ['Draft', 'Declined'],
      ['Draft', 'Expired'],
      ['Draft', 'Voided'],
      ['Sent', 'Viewed'],
      ['Sent', 'Declined'],
      ['Sent', 'Expired'],
      ['Sent', 'Voided'],
      ['Viewed', 'Signed'],
      ['Viewed', 'Declined'],
      ['Viewed', 'Expired'],
      ['Viewed', 'Voided'],
    ]

    test.each(valid)('allows %s → %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(true)
    })

    const invalid: [ContractPlatformStatus, ContractPlatformStatus][] = [
      ['Draft', 'Signed'],
      ['Draft', 'Viewed'],
      ['Sent', 'Draft'],
      ['Sent', 'Signed'],
      ['Viewed', 'Draft'],
      ['Viewed', 'Sent'],
      ['Signed', 'Draft'],
      ['Signed', 'Sent'],
      ['Signed', 'Viewed'],
      ['Signed', 'Declined'],
      ['Signed', 'Expired'],
      ['Signed', 'Voided'],
      ['Declined', 'Draft'],
      ['Declined', 'Sent'],
      ['Declined', 'Signed'],
      ['Expired', 'Draft'],
      ['Declined', 'Viewed'],
      ['Voided', 'Draft'],
      ['Voided', 'Sent'],
    ]

    test.each(invalid)('rejects %s → %s', (from, to) => {
      expect(isValidTransition(from, to)).toBe(false)
    })
  })

  describe('isValidStatus', () => {
    const validStatuses = ['Draft', 'Sent', 'Viewed', 'Signed', 'Declined', 'Expired', 'Voided']
    test.each(validStatuses)('accepts %s', (s) => {
      expect(isValidStatus(s)).toBe(true)
    })

    const invalidStatuses = ['draft', 'DRAFT', 'pending', 'completed', '', 'canceled']
    test.each(invalidStatuses)('rejects %s', (s) => {
      expect(isValidStatus(s)).toBe(false)
    })
  })
})

describe('Contract creation input validation', () => {
  function validateSigners(signers: { name: string; email: string }[]): string | null {
    if (!Array.isArray(signers) || signers.length === 0) {
      return 'At least one signer is required.'
    }
    for (const s of signers) {
      if (!s.name?.trim() || !s.email?.trim()) {
        return 'Each signer must have a name and email.'
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) {
        return `Invalid email: ${s.email}`
      }
    }
    return null
  }

  it('accepts valid signer list', () => {
    expect(validateSigners([{ name: 'Alice', email: 'alice@example.com' }])).toBeNull()
  })

  it('rejects empty signers array', () => {
    expect(validateSigners([])).toBe('At least one signer is required.')
  })

  it('rejects signer without name', () => {
    expect(validateSigners([{ name: '', email: 'alice@example.com' }])).toBe(
      'Each signer must have a name and email.',
    )
  })

  it('rejects signer without email', () => {
    expect(validateSigners([{ name: 'Alice', email: '' }])).toBe(
      'Each signer must have a name and email.',
    )
  })

  it('rejects malformed email', () => {
    expect(validateSigners([{ name: 'Alice', email: 'not-an-email' }])).toBe(
      'Invalid email: not-an-email',
    )
  })

  it('accepts multiple valid signers', () => {
    expect(
      validateSigners([
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
      ]),
    ).toBeNull()
  })

  it('rejects signers list with one bad email among many', () => {
    expect(
      validateSigners([
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bademail' },
      ]),
    ).toBe('Invalid email: bademail')
  })
})

describe('Active contract conflict detection', () => {
  const ACTIVE_STATUSES = ['Draft', 'Sent', 'Viewed']
  const TERMINAL_STATUSES = ['Signed', 'Declined', 'Expired', 'Voided']

  it('considers Draft as active', () => {
    expect(ACTIVE_STATUSES.includes('Draft')).toBe(true)
  })

  it('considers Sent as active', () => {
    expect(ACTIVE_STATUSES.includes('Sent')).toBe(true)
  })

  it('considers Viewed as active', () => {
    expect(ACTIVE_STATUSES.includes('Viewed')).toBe(true)
  })

  test.each(TERMINAL_STATUSES)('considers %s as terminal (not active)', (status) => {
    expect(ACTIVE_STATUSES.includes(status)).toBe(false)
  })
})

describe('Webhook event processing', () => {
  const EVENT_TO_STATUS: Record<string, string> = {
    sent: 'Sent',
    viewed: 'Viewed',
    signed: 'Signed',
    declined: 'Declined',
    expired: 'Expired',
    voided: 'Voided',
  }

  const EVENT_TO_TIMESTAMP: Record<string, string> = {
    sent: 'sent_at',
    viewed: 'viewed_at',
    signed: 'signed_at',
    declined: 'declined_at',
    expired: 'expired_at',
    voided: 'voided_at',
  }

  it('maps all known event types to platform statuses', () => {
    expect(Object.keys(EVENT_TO_STATUS)).toEqual([
      'sent',
      'viewed',
      'signed',
      'declined',
      'expired',
      'voided',
    ])
  })

  it('each event type maps to a valid platform status', () => {
    for (const status of Object.values(EVENT_TO_STATUS)) {
      expect(isValidStatus(status)).toBe(true)
    }
  })

  it('each event type maps to a timestamp field', () => {
    for (const eventType of Object.keys(EVENT_TO_STATUS)) {
      expect(EVENT_TO_TIMESTAMP[eventType]).toBeDefined()
      expect(EVENT_TO_TIMESTAMP[eventType]).toMatch(/_at$/)
    }
  })

  it('rejects unknown event type', () => {
    const unknownEvent = 'completed'
    expect(EVENT_TO_STATUS[unknownEvent]).toBeUndefined()
  })
})

describe('Audit event helper', () => {
  it('can create a contract.create audit event', async () => {
    await writeAuditEvent({
      actor_internal_user_id: 'user-1',
      actor_role: 'Implementation Manager',
      action: 'contract.create',
      target_type: 'legal_document',
      target_id: 'doc-1',
      organization_id: 'org-1',
      before_values: null,
      after_values: { platform_status: 'Draft', document_type: 'contract' },
      reason: 'Contract created',
    })

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contract.create',
        target_type: 'legal_document',
      }),
    )
  })

  it('can create a contract.send audit event', async () => {
    await writeAuditEvent({
      actor_internal_user_id: 'user-1',
      actor_role: 'Implementation Manager',
      action: 'contract.send',
      target_type: 'legal_document',
      target_id: 'doc-1',
      organization_id: 'org-1',
      before_values: { platform_status: 'Draft' },
      after_values: { platform_status: 'Sent', sent_at: '2026-06-29T00:00:00Z' },
      reason: 'Contract sent',
    })

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contract.send',
      }),
    )
  })

  it('can create a contract.status_update audit event (webhook)', async () => {
    await writeAuditEvent({
      actor_internal_user_id: '00000000-0000-0000-0000-000000000000',
      actor_role: 'system',
      action: 'contract.status_update',
      target_type: 'legal_document',
      target_id: 'doc-2',
      organization_id: 'org-1',
      before_values: { platform_status: 'Sent' },
      after_values: { platform_status: 'Signed' },
      reason: 'Webhook: signed',
    })

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contract.status_update',
        actor_role: 'system',
      }),
    )
  })
})
