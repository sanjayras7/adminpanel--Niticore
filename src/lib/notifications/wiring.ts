import { triggerEventBus } from './event-bus'
import { emitNotification } from './emitter'
import { EventTypes, TriggerEventPayload } from './trigger-events'
import type { NotificationEvent } from './types'

interface EventMapping {
  eventType: string
  title: string
  body: string
  isUserSpecific: boolean
}

const eventMappings: EventMapping[] = [
  { eventType: EventTypes.LEAD_CREATED, title: 'New Lead Received', body: 'A new website lead has been received and is ready for review', isUserSpecific: false },
  { eventType: EventTypes.NDA_SIGNED, title: 'NDA Signed', body: 'An NDA has been signed by the prospect', isUserSpecific: false },
  { eventType: EventTypes.CONTRACT_SIGNED, title: 'Contract Signed', body: 'The contract has been signed and is now active', isUserSpecific: false },
  { eventType: EventTypes.CONTRACT_DECLINED, title: 'Contract Declined', body: 'The contract has been declined by the prospect', isUserSpecific: false },
  { eventType: EventTypes.CONTRACT_EXPIRED, title: 'Contract Expired', body: 'The contract has expired without being signed', isUserSpecific: false },
  { eventType: EventTypes.PROVISIONING_FAILED, title: 'Provisioning Failed', body: 'Tenant provisioning has encountered a failure', isUserSpecific: false },
  { eventType: EventTypes.TENANT_READY_FOR_ACTIVATION, title: 'Tenant Ready for Activation', body: 'The tenant is ready for activation', isUserSpecific: false },
  { eventType: EventTypes.TOTP_RESET, title: 'TOTP Reset Completed', body: 'Your TOTP has been reset by a Super Admin', isUserSpecific: true },
]

function buildNotificationEvent(eventType: string, payload: TriggerEventPayload, mapping: EventMapping): NotificationEvent | null {
  const notification: NotificationEvent = {
    type: eventType,
    title: mapping.title,
    body: mapping.body,
    organization_id: payload.organizationId ?? null,
    lead_id: payload.leadId ?? null,
  }

  if (mapping.isUserSpecific) {
    if (!payload.affectedUserId) {
      console.error(`[TRIGGER_WIRING] ${eventType} event missing affectedUserId — skipping dispatch`)
      return null
    }
    notification.target_owner_id = payload.affectedUserId
  }

  return notification
}

export function registerTriggerHandlers(
  emit: (event: NotificationEvent) => void = emitNotification,
): void {
  for (const mapping of eventMappings) {
    triggerEventBus.on(mapping.eventType, (rawPayload: Record<string, unknown>) => {
      try {
        const payload = rawPayload as unknown as TriggerEventPayload
        const event = buildNotificationEvent(mapping.eventType, payload, mapping)
        if (!event) return
        emit(event)
      } catch (err) {
        console.error(`[TRIGGER_WIRING] Failed to handle ${mapping.eventType}:`, err)
      }
    })
  }
}
