type EventHandler = (event: Record<string, unknown>) => void | Promise<void>

class TriggerEventBus {
  private handlers = new Map<string, EventHandler[]>()

  on(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }

  emit(eventType: string, payload: Record<string, unknown>): void {
    const handlers = this.handlers.get(eventType)
    if (!handlers) return
    for (const handler of handlers) {
      handler(payload)
    }
  }

  removeAllListeners(): void {
    this.handlers.clear()
  }
}

export const triggerEventBus = new TriggerEventBus()
