import { formatAuditEvent, AUDIT_EVENT_TEMPLATES, InternalAuditEvent } from '@/lib/audit-event-formatter'

function makeEvent(overrides: Partial<InternalAuditEvent> = {}): InternalAuditEvent {
  return {
    id: 'evt-001',
    actor_internal_user_id: 'user-abc',
    actor_role: 'Super Admin',
    action: 'login',
    target_type: null,
    target_id: null,
    organization_id: null,
    lead_id: null,
    before_values: null,
    after_values: null,
    reason: null,
    metadata: null,
    ip_address: null,
    user_agent: null,
    created_at: new Date('2026-06-26T12:00:00Z'),
    ...overrides,
  }
}

describe('AuditEventFormatter', () => {
  describe('AUDIT_EVENT_TEMPLATES registry', () => {
    it('exports at least 10 event templates', () => {
      const count = Object.keys(AUDIT_EVENT_TEMPLATES).length
      expect(count).toBeGreaterThanOrEqual(10)
    })
  })

  describe('auth / login events', () => {
    it('formats login with actor name and IP', () => {
      const event = makeEvent({
        action: 'login',
        actor_internal_user_id: 'Jane Doe',
        actor_role: 'Super Admin',
        ip_address: '192.168.1.1',
      })
      expect(formatAuditEvent(event)).toBe('Jane Doe (Super Admin) logged in from 192.168.1.1')
    })

    it('formats login with unknown IP when ip_address is null', () => {
      const event = makeEvent({ action: 'login', ip_address: null })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) logged in from unknown IP')
    })

    it('formats login_failed', () => {
      const event = makeEvent({
        action: 'login_failed',
        target_id: 'jane@example.com',
        ip_address: '10.0.0.1',
      })
      expect(formatAuditEvent(event)).toBe('Failed login attempt for jane@example.com from 10.0.0.1')
    })

    it('formats logout', () => {
      const event = makeEvent({ action: 'logout' })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) logged out')
    })
  })

  describe('TOTP events', () => {
    it('formats totp_enroll with target user email from metadata', () => {
      const event = makeEvent({
        action: 'totp_enroll',
        metadata: { target_user_email: 'john@example.com' },
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) enrolled TOTP for john@example.com')
    })

    it('formats totp_reset with target user email from target_id fallback', () => {
      const event = makeEvent({
        action: 'totp_reset',
        target_id: 'john@example.com',
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) reset TOTP for john@example.com')
    })
  })

  describe('RBAC / internal user events', () => {
    it('formats role_changed with before and after values', () => {
      const event = makeEvent({
        action: 'role_changed',
        metadata: { target_user_email: 'bob@example.com' },
        before_values: { role_name: 'Support' },
        after_values: { role_name: 'Implementation Manager' },
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) changed role for bob@example.com from Support to Implementation Manager',
      )
    })

    it('formats role_changed with unknown when before_values is null', () => {
      const event = makeEvent({
        action: 'role_changed',
        target_id: 'bob@example.com',
        before_values: null,
        after_values: { role_name: 'Support' },
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) changed role for bob@example.com from unknown to Support',
      )
    })

    it('formats internal_user_created', () => {
      const event = makeEvent({
        action: 'internal_user_created',
        metadata: { target_user_email: 'new@example.com' },
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) created internal user new@example.com')
    })

    it('formats internal_user_deactivated', () => {
      const event = makeEvent({
        action: 'internal_user_deactivated',
        target_id: 'old@example.com',
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) deactivated internal user old@example.com')
    })
  })

  describe('lead / CRM events', () => {
    it('formats lead_created with company name from metadata', () => {
      const event = makeEvent({
        action: 'lead_created',
        target_id: 'lead-42',
        metadata: { company_name: 'Acme Corp' },
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) created lead lead-42 (Acme Corp)')
    })

    it('formats lead_created without company name when metadata is null', () => {
      const event = makeEvent({ action: 'lead_created', target_id: 'lead-42' })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) created lead lead-42')
    })

    it('formats lead_status_changed', () => {
      const event = makeEvent({
        action: 'lead_status_changed',
        target_id: 'lead-99',
        before_values: { status: 'new' },
        after_values: { status: 'qualified' },
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) changed lead lead-99 status from new to qualified',
      )
    })

    it('formats lead_assigned', () => {
      const event = makeEvent({
        action: 'lead_assigned',
        target_id: 'lead-77',
        metadata: { assigned_owner_name: 'Alice' },
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) assigned lead lead-77 to Alice')
    })
  })

  describe('tenant / provisioning events', () => {
    it('formats tenant_provisioned with company name', () => {
      const event = makeEvent({
        action: 'tenant_provisioned',
        target_id: 'org-hash-xyz',
        metadata: { company_name: 'Widgets Inc' },
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) provisioned tenant org-hash-xyz (Widgets Inc)',
      )
    })

    it('formats tenant_reprovisioned', () => {
      const event = makeEvent({ action: 'tenant_reprovisioned', target_id: 'org-hash-abc' })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) reprovisioned tenant org-hash-abc')
    })

    it('formats tenant_deactivated', () => {
      const event = makeEvent({ action: 'tenant_deactivated', target_id: 'org-hash-def' })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) deactivated tenant org-hash-def')
    })
  })

  describe('document / e-sign events', () => {
    it('formats document_sent with document type and signer email', () => {
      const event = makeEvent({
        action: 'document_sent',
        target_id: 'doc-123',
        metadata: { document_type: 'NDA', signer_email: 'signer@example.com' },
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) sent document doc-123 (NDA) to signer@example.com',
      )
    })

    it('formats document_signed', () => {
      const event = makeEvent({
        action: 'document_signed',
        target_id: 'doc-456',
        metadata: { document_type: 'Contract' },
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) signed document doc-456 (Contract)')
    })

    it('formats document_declined', () => {
      const event = makeEvent({ action: 'document_declined', target_id: 'doc-789' })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) declined document doc-789')
    })
  })

  describe('impersonation events', () => {
    it('formats impersonation_started', () => {
      const event = makeEvent({
        action: 'impersonation_started',
        target_id: 'session-001',
        organization_id: 'org-42',
        metadata: { impersonated_user_email: 'customer@example.com' },
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) started impersonation session session-001 on organization org-42 as user customer@example.com',
      )
    })

    it('formats impersonation_ended', () => {
      const event = makeEvent({
        action: 'impersonation_ended',
        target_id: 'session-001',
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) ended impersonation session session-001')
    })
  })

  describe('control / framework events', () => {
    it('formats control_created', () => {
      const event = makeEvent({
        action: 'control_created',
        target_id: 'ctrl-001',
        metadata: { control_code: 'CC-5.1' },
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) created control ctrl-001 (CC-5.1)')
    })

    it('formats control_updated', () => {
      const event = makeEvent({ action: 'control_updated', target_id: 'ctrl-001' })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) updated control ctrl-001')
    })

    it('formats control_deleted', () => {
      const event = makeEvent({ action: 'control_deleted', target_id: 'ctrl-002' })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) deleted control ctrl-002')
    })

    it('formats framework_created with framework name', () => {
      const event = makeEvent({
        action: 'framework_created',
        target_id: 'fw-01',
        metadata: { framework_name: 'SOC 2' },
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) created framework fw-01 (SOC 2)')
    })

    it('formats framework_published', () => {
      const event = makeEvent({ action: 'framework_published', target_id: 'fw-02' })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) published framework fw-02')
    })
  })

  describe('other events', () => {
    it('formats organization_module_configured', () => {
      const event = makeEvent({
        action: 'organization_module_configured',
        organization_id: 'org-55',
        metadata: { module_name: 'Framework Config' },
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) configured module Framework Config for organization org-55',
      )
    })

    it('formats gate_override with reason', () => {
      const event = makeEvent({
        action: 'gate_override',
        target_type: 'lead',
        target_id: 'lead-33',
        metadata: { gate_type: 'nda_required' },
        reason: 'Client requested expedited access',
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) overrode gate nda_required for lead lead-33 (reason: Client requested expedited access)',
      )
    })

    it('formats gate_override without reason', () => {
      const event = makeEvent({
        action: 'gate_override',
        target_type: 'organization',
        target_id: 'org-01',
        metadata: { gate_type: 'contract_signed' },
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) overrode gate contract_signed for organization org-01 (reason: no reason given)',
      )
    })

    it('formats magic_link_sent', () => {
      const event = makeEvent({
        action: 'magic_link_sent',
        target_id: 'jane@example.com',
        actor_internal_user_id: 'System',
        actor_role: null,
      })
      expect(formatAuditEvent(event)).toBe('System sent magic link to jane@example.com')
    })

    it('formats tenant_note_added', () => {
      const event = makeEvent({
        action: 'tenant_note_added',
        organization_id: 'org-88',
      })
      expect(formatAuditEvent(event)).toBe('user-abc (Super Admin) added note to tenant org-88')
    })

    it('formats onboarding_checklist_updated', () => {
      const event = makeEvent({
        action: 'onboarding_checklist_updated',
        metadata: { item_key: 'send_nda', new_status: 'completed' },
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) updated onboarding checklist item send_nda to completed',
      )
    })
  })

  describe('edge cases', () => {
    it('returns generic fallback for unknown action', () => {
      const event = makeEvent({
        action: 'some_future_action',
        target_type: 'widget',
        target_id: 'w-001',
      })
      expect(formatAuditEvent(event)).toBe('some_future_action on widget w-001')
    })

    it('returns simple fallback when target_type and target_id are null', () => {
      const event = makeEvent({ action: 'some_unknown_action' })
      expect(formatAuditEvent(event)).toBe('some_unknown_action')
    })

    it('handles null actor_internal_user_id as System', () => {
      const event = makeEvent({
        action: 'login',
        actor_internal_user_id: null,
        actor_role: null,
        ip_address: '10.0.0.1',
      })
      expect(formatAuditEvent(event)).toBe('System logged in from 10.0.0.1')
    })

    it('handles null before_values and after_values gracefully', () => {
      const event = makeEvent({
        action: 'lead_status_changed',
        target_id: 'lead-1',
        before_values: null,
        after_values: null,
      })
      expect(formatAuditEvent(event)).toBe(
        'user-abc (Super Admin) changed lead lead-1 status from unknown to unknown',
      )
    })

    it('truncates long metadata values with ellipsis', () => {
      const longCompanyName = 'A'.repeat(200)
      const event = makeEvent({
        action: 'lead_created',
        target_id: 'lead-42',
        metadata: { company_name: longCompanyName },
      })
      const result = formatAuditEvent(event)
      expect(result).toContain('\u2026')
      expect(result.length).toBeLessThan(150)
    })

    it('handles numeric metadata values without crashing', () => {
      const event = makeEvent({
        action: 'login',
        actor_internal_user_id: 'System',
        actor_role: null,
        ip_address: '10.0.0.1',
      })
      expect(formatAuditEvent(event)).toBe('System logged in from 10.0.0.1')
    })
  })
})
