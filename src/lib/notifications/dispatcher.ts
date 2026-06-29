import { v4 as uuidv4 } from 'uuid'
import { config } from '@/config'
import { sequelize } from '@/lib/sequelize'
import { InternalUser } from '@/lib/models/InternalUser'
import { InternalRole } from '@/lib/models/InternalRole'
import { notificationEmitter } from './emitter'
import { NotificationEvent } from './types'

interface ResolvedRecipient {
  user_id: string
  email: string
}

async function resolveRecipients(
  event: NotificationEvent,
): Promise<ResolvedRecipient[]> {
  if (event.target_owner_id) {
    const user = await InternalUser.findByPk(event.target_owner_id, {
      attributes: ['id', 'email'],
    })
    if (user && user.status !== 'inactive' && !user.deleted_at) {
      return [{ user_id: user.id, email: user.email }]
    }
  }

  if (event.target_role) {
    const users = await InternalUser.findAll({
      include: [{
        model: InternalRole,
        as: 'role',
        where: { name: event.target_role, is_active: true },
        required: true,
      }],
      where: { status: 'active', deleted_at: null },
      attributes: ['id', 'email'],
    })
    return users.map(u => ({ user_id: u.id, email: u.email }))
  }

  const defaultRoles = ['Super Admin', 'Implementation Manager']
  const users = await InternalUser.findAll({
    include: [{
      model: InternalRole,
      as: 'role',
      where: { name: defaultRoles, is_active: true },
      required: true,
    }],
    where: { status: 'active', deleted_at: null },
    attributes: ['id', 'email'],
  })

  if (users.length === 0) {
    console.warn('[NOTIFICATIONS] No recipients resolved for event:', event.type)
  }

  return users.map(u => ({ user_id: u.id, email: u.email }))
}

async function storeNotification(
  recipientId: string,
  event: NotificationEvent,
): Promise<void> {
  try {
    await sequelize.query(
      `INSERT INTO notifications
        (id, recipient_id, organization_id, lead_id, title, body, channel, metadata, created_at)
       VALUES
        (:id, :recipient_id, :organization_id, :lead_id, :title, :body, :channel, :metadata::jsonb, NOW())`,
      {
        replacements: {
          id: uuidv4(),
          recipient_id: recipientId,
          organization_id: event.organization_id ?? null,
          lead_id: event.lead_id ?? null,
          title: event.title,
          body: event.body,
          channel: 'in_app',
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        },
      },
    )
  } catch (err) {
    console.error('[NOTIFICATIONS] Failed to store notification:', err)
  }
}

async function sendEmailNotification(
  email: string,
  event: NotificationEvent,
): Promise<void> {
  try {
    if (config.isTest) {
      return
    }
    console.log(`[NOTIFICATIONS] Email to ${email}: ${event.title} - ${event.body}`)
  } catch (err) {
    console.error('[NOTIFICATIONS] Email send failed:', err)
  }
}

async function handleNotification(event: NotificationEvent): Promise<void> {
  try {
    const recipients = await resolveRecipients(event)

    for (const recipient of recipients) {
      await storeNotification(recipient.user_id, event)

      await sendEmailNotification(recipient.email, event)
    }
  } catch (err) {
    console.error('[NOTIFICATIONS] Dispatcher error:', err)
  }
}

let initialized = false

export function initNotificationDispatcher(): void {
  if (initialized) {
    return
  }
  notificationEmitter.on('notification', (event: NotificationEvent) => {
    handleNotification(event)
  })
  initialized = true
}

export function resetDispatcherForTest(): void {
  notificationEmitter.removeAllListeners('notification')
  initialized = false
}
