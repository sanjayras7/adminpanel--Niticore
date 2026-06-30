import { triggerEventBus } from '@/lib/notifications/event-bus'
import { EventTypes, TriggerEventPayload } from '@/lib/notifications/trigger-events'
import { registerTriggerHandlers } from '@/lib/notifications/wiring'
import type { NotificationEvent } from '@/lib/notifications/types'

beforeEach(() => {
  triggerEventBus.removeAllListeners()
})

afterEach(() => {
  triggerEventBus.removeAllListeners()
})

describe('team-wide trigger events', () => {
  it.each([
    { eventType: EventTypes.LEAD_CREATED, payload: { leadId: 'lead-1' }, expectedTitle: 'New Lead Received', checks: (e: NotificationEvent) => { expect(e.lead_id).toBe('lead-1') } },
    { eventType: EventTypes.NDA_SIGNED, payload: { organizationId: 'org-1' }, expectedTitle: 'NDA Signed', checks: (e: NotificationEvent) => { expect(e.organization_id).toBe('org-1') } },
    { eventType: EventTypes.CONTRACT_SIGNED, payload: { organizationId: 'org-1', leadId: 'lead-1' }, expectedTitle: 'Contract Signed', checks: (e: NotificationEvent) => { expect(e.organization_id).toBe('org-1'); expect(e.lead_id).toBe('lead-1') } },
    { eventType: EventTypes.CONTRACT_DECLINED, payload: { organizationId: 'org-1' }, expectedTitle: 'Contract Declined', checks: (_e: NotificationEvent) => {} },
    { eventType: EventTypes.CONTRACT_EXPIRED, payload: { organizationId: 'org-1' }, expectedTitle: 'Contract Expired', checks: (_e: NotificationEvent) => {} },
    { eventType: EventTypes.PROVISIONING_FAILED, payload: { organizationId: 'org-1' }, expectedTitle: 'Provisioning Failed', checks: (_e: NotificationEvent) => {} },
    { eventType: EventTypes.TENANT_READY_FOR_ACTIVATION, payload: { organizationId: 'org-1' }, expectedTitle: 'Tenant Ready for Activation', checks: (_e: NotificationEvent) => {} },
  ])('dispatches $eventType notification', ({ eventType, payload, expectedTitle, checks }) => {
    const emit = jest.fn()
    triggerEventBus.removeAllListeners()
    registerTriggerHandlers(emit)

    triggerEventBus.emit(eventType, payload as unknown as Record<string, unknown>)

    expect(emit).toHaveBeenCalledTimes(1)
    const event = emit.mock.calls[0][0] as NotificationEvent
    expect(event.type).toBe(eventType)
    expect(event.title).toBe(expectedTitle)
    expect(event.target_owner_id).toBeUndefined()
    checks(event)
  })
})

describe('TOTP reset trigger event', () => {
  it('dispatches with target_owner_id when affectedUserId is provided', () => {
    const emit = jest.fn()
    triggerEventBus.removeAllListeners()
    registerTriggerHandlers(emit)

    triggerEventBus.emit(EventTypes.TOTP_RESET, { affectedUserId: 'user-42' })

    expect(emit).toHaveBeenCalledTimes(1)
    const event = emit.mock.calls[0][0] as NotificationEvent
    expect(event.type).toBe(EventTypes.TOTP_RESET)
    expect(event.title).toBe('TOTP Reset Completed')
    expect(event.target_owner_id).toBe('user-42')
    expect(event.body).toBe('Your TOTP has been reset by a Super Admin')
  })

  it('does not dispatch when affectedUserId is missing', () => {
    const emit = jest.fn()
    triggerEventBus.removeAllListeners()
    registerTriggerHandlers(emit)

    triggerEventBus.emit(EventTypes.TOTP_RESET, {})

    expect(emit).not.toHaveBeenCalled()
  })
})
