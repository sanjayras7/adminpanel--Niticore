import { EventEmitter } from 'events'
import { NotificationEvent } from './types'

export const notificationEmitter = new EventEmitter()

notificationEmitter.setMaxListeners(100)

export function emitNotification(event: NotificationEvent): void {
  notificationEmitter.emit('notification', event)
}
