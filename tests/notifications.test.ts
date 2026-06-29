import { EventEmitter } from 'events'
import { emitNotification, notificationEmitter, initNotificationDispatcher, resetDispatcherForTest } from '@/lib/notifications'
import { NotificationEvent } from '@/lib/notifications/types'

jest.mock('@/lib/models/InternalUser', () => ({
  InternalUser: Object.assign(jest.fn(), {
    findByPk: jest.fn(),
    findAll: jest.fn(),
  }),
}))

jest.mock('@/lib/models/InternalRole', () => ({
  InternalRole: jest.fn(),
}))

jest.mock('@/lib/sequelize', () => ({
  sequelize: { query: jest.fn().mockResolvedValue([[], {}]) },
}))

import { InternalUser } from '@/lib/models/InternalUser'
import { sequelize } from '@/lib/sequelize'

const InternalUserMock = InternalUser as unknown as { findByPk: jest.Mock; findAll: jest.Mock }
const sequelizeMock = sequelize as unknown as { query: jest.Mock }

beforeEach(() => {
  resetDispatcherForTest()
  jest.clearAllMocks()
})

describe('notification emitter', () => {
  it('emits a notification event that can be subscribed to', (done) => {
    const event: NotificationEvent = {
      type: 'test.event',
      title: 'Test Title',
      body: 'Test body',
    }

    notificationEmitter.once('notification', (received: NotificationEvent) => {
      expect(received.type).toBe('test.event')
      expect(received.title).toBe('Test Title')
      expect(received.body).toBe('Test body')
      done()
    })

    emitNotification(event)
  })

  it('supports multiple concurrent listeners up to 100', () => {
    expect(notificationEmitter.getMaxListeners()).toBe(100)
  })

  it('does not crash when emitting without listeners', () => {
    const event: NotificationEvent = {
      type: 'no.listener',
      title: 'No Listeners',
      body: 'Should not crash',
    }
    expect(() => emitNotification(event)).not.toThrow()
  })
})

describe('notification dispatcher', () => {
  describe('successful dispatch', () => {
    it('stores an in-app notification for an owner-id recipient', async () => {
      InternalUserMock.findByPk.mockResolvedValue({
        id: 'user-1',
        email: 'owner@example.com',
        status: 'active',
        deleted_at: null,
      })
      InternalUserMock.findAll.mockResolvedValue([])

      initNotificationDispatcher()

      const event: NotificationEvent = {
        type: 'lead.assigned',
        target_owner_id: 'user-1',
        organization_id: 'org-1',
        lead_id: 'lead-1',
        title: 'Lead Assigned',
        body: 'A new lead has been assigned to you',
      }

      emitNotification(event)

      await new Promise(setImmediate)

      expect(sequelizeMock.query).toHaveBeenCalledTimes(1)
      const queryCall = sequelizeMock.query.mock.calls[0]
      const sql = queryCall[0]
      const replacements = queryCall[1].replacements
      expect(sql).toContain('INSERT INTO notifications')
      expect(replacements.recipient_id).toBe('user-1')
      expect(replacements.organization_id).toBe('org-1')
      expect(replacements.lead_id).toBe('lead-1')
      expect(replacements.title).toBe('Lead Assigned')
      expect(replacements.channel).toBe('in_app')
    })

    it('resolves recipients by target_role', async () => {
      InternalUserMock.findByPk.mockResolvedValue(null)
      InternalUserMock.findAll.mockResolvedValue([
        { id: 'user-1', email: 'impl@example.com' },
        { id: 'user-2', email: 'impl2@example.com' },
      ])

      initNotificationDispatcher()

      const event: NotificationEvent = {
        type: 'onboarding.complete',
        target_role: 'Implementation Manager',
        title: 'Onboarding Complete',
        body: 'A tenant onboarding has been completed',
      }

      emitNotification(event)

      await new Promise(setImmediate)

      expect(InternalUserMock.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: [expect.objectContaining({
            where: expect.objectContaining({
              name: 'Implementation Manager',
              is_active: true,
            }),
          })],
          where: { status: 'active', deleted_at: null },
        }),
      )
      expect(sequelizeMock.query).toHaveBeenCalledTimes(2)
    })

    it('falls back to default group (Super Admin, Implementation Manager)', async () => {
      InternalUserMock.findByPk.mockResolvedValue(null)
      InternalUserMock.findAll.mockResolvedValue([
        { id: 'admin-1', email: 'admin@example.com' },
        { id: 'impl-1', email: 'impl@example.com' },
      ])

      initNotificationDispatcher()

      const event: NotificationEvent = {
        type: 'nda.signed',
        title: 'NDA Signed',
        body: 'A new NDA has been signed',
      }

      emitNotification(event)

      await new Promise(setImmediate)

      expect(InternalUserMock.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: [expect.objectContaining({
            where: expect.objectContaining({
              name: ['Super Admin', 'Implementation Manager'],
              is_active: true,
            }),
          })],
        }),
      )
    })

    it('skips inactive owner and falls through to default group', async () => {
      InternalUserMock.findByPk.mockResolvedValue(null)
      InternalUserMock.findAll.mockResolvedValue([
        { id: 'admin-1', email: 'admin@example.com' },
      ])

      initNotificationDispatcher()

      const event: NotificationEvent = {
        type: 'lead.assigned',
        target_owner_id: 'inactive-user',
        title: 'Lead Assigned',
        body: 'Test fallthrough',
      }

      emitNotification(event)

      await new Promise(setImmediate)

      expect(InternalUserMock.findAll).toHaveBeenCalled()
    })
  })

  describe('simulated send failure isolation', () => {
    it('does not propagate a DB insert failure to the emitter', async () => {
      InternalUserMock.findByPk.mockResolvedValue({
        id: 'user-1',
        email: 'owner@example.com',
        status: 'active',
        deleted_at: null,
      })
      InternalUserMock.findAll.mockResolvedValue([])
      sequelizeMock.query.mockRejectedValueOnce(new Error('DB connection lost'))

      initNotificationDispatcher()

      const event: NotificationEvent = {
        type: 'lead.assigned',
        target_owner_id: 'user-1',
        title: 'Lead Assigned',
        body: 'Should not crash emitter',
      }

      expect(() => {
        emitNotification(event)
      }).not.toThrow()

      await new Promise(setImmediate)
    })

    it('continues storing for remaining recipients when one insert fails', async () => {
      InternalUserMock.findByPk.mockResolvedValue(null)
      InternalUserMock.findAll.mockResolvedValue([
        { id: 'user-1', email: 'one@example.com' },
        { id: 'user-2', email: 'two@example.com' },
      ])
      sequelizeMock.query
        .mockRejectedValueOnce(new Error('DB error for user-1'))
        .mockResolvedValueOnce([[], {}])

      initNotificationDispatcher()

      const event: NotificationEvent = {
        type: 'bulk.event',
        target_role: 'Super Admin',
        title: 'Bulk Event',
        body: 'Multiple recipients',
      }

      emitNotification(event)

      await new Promise(setImmediate)

      expect(sequelizeMock.query).toHaveBeenCalledTimes(2)
    })
  })

  describe('fallback logic', () => {
    it('logs a warning when no recipients are found', async () => {
      InternalUserMock.findByPk.mockResolvedValue(null)
      InternalUserMock.findAll.mockResolvedValue([])
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      initNotificationDispatcher()

      const event: NotificationEvent = {
        type: 'orphan.event',
        title: 'No Recipients',
        body: 'Should log warning',
      }

      emitNotification(event)

      await new Promise(setImmediate)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[NOTIFICATIONS] No recipients resolved for event:',
        'orphan.event',
      )

      consoleWarnSpy.mockRestore()
    })

    it('handles resolveRecipients throwing an error gracefully', async () => {
      InternalUserMock.findByPk.mockRejectedValue(new Error('Unexpected DB error'))

      initNotificationDispatcher()

      const event: NotificationEvent = {
        type: 'failing.event',
        target_owner_id: 'user-1',
        title: 'Failing',
        body: 'Should not propagate error',
      }

      expect(() => {
        emitNotification(event)
      }).not.toThrow()

      await new Promise(setImmediate)
    })
  })

  describe('emitter contract', () => {
    it('is an EventEmitter instance', () => {
      expect(notificationEmitter).toBeInstanceOf(EventEmitter)
    })

    it('idempotent init does not register duplicate listeners', () => {
      initNotificationDispatcher()
      initNotificationDispatcher()
      initNotificationDispatcher()

      const listeners = notificationEmitter.listeners('notification')
      expect(listeners).toHaveLength(1)
    })
  })
})
