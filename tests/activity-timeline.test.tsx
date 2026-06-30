/**
 * @jest-environment node
 */
import React from 'react'
import { renderToString } from 'react-dom/server'
import { ActivityTimelineItem } from '@/components/ActivityTimelineItem'
import type { AuditTimelineEvent } from '@/types/audit-timeline'

function makeEvent(overrides: Partial<AuditTimelineEvent> = {}): AuditTimelineEvent {
  return {
    id: 'evt-001',
    actor: { id: 'user-abc', role: 'Super Admin' },
    action: 'login',
    description: 'user-abc (Super Admin) logged in from 192.168.1.1',
    target: null,
    organizationId: null,
    leadId: null,
    beforeValues: null,
    afterValues: null,
    reason: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('ActivityTimelineItem', () => {
  describe('rendering', () => {
    it('renders the event description', () => {
      const event = makeEvent()
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain(event.description)
    })

    it('renders the action badge', () => {
      const event = makeEvent({ action: 'lead_created' })
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain('lead_created')
    })

    it('renders the actor label', () => {
      const event = makeEvent({ actor: { id: 'alice', role: 'Super Admin' } })
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain('alice (Super Admin)')
    })

    it('renders "System" for system actor without role', () => {
      const event = makeEvent({ actor: { id: 'System', role: '' } })
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain('System')
      expect(html).not.toContain('(System)')
    })

    it('renders target type and id when present', () => {
      const event = makeEvent({
        target: { type: 'lead', id: '550e8400-e29b-41d4-a716-446655440000' },
      })
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain('lead')
      expect(html).toContain('550e8400')
    })

    it('renders reason when present', () => {
      const event = makeEvent({
        reason: 'Client requested expedited access',
        beforeValues: null,
        afterValues: null,
      })
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain('Reason')
      expect(html).toContain('Client requested expedited access')
    })

    it('renders before/after values when present', () => {
      const event = makeEvent({
        beforeValues: { status: 'new' },
        afterValues: { status: 'qualified' },
        reason: null,
      })
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain('Before')
      expect(html).toContain('After')
      expect(html).toContain('new')
      expect(html).toContain('qualified')
    })

    it('does not show details section when reason and before/after are absent', () => {
      const event = makeEvent({
        reason: null,
        beforeValues: null,
        afterValues: null,
      })
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).not.toContain('Show details')
    })

    it('renders organizationId badge when present', () => {
      const event = makeEvent({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        target: { type: 'organization', id: 'org-id' },
      })
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain('org:')
      expect(html).toContain('550e8400')
    })

    it('renders leadId badge when present', () => {
      const event = makeEvent({
        leadId: '550e8400-e29b-41d4-a716-446655440000',
        target: { type: 'lead', id: 'lead-id' },
      })
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain('lead:')
      expect(html).toContain('550e8400')
    })
  })

  describe('timeline item differentiation', () => {
    it('applies data-testid with correct index', () => {
      const event = makeEvent()
      const html = renderToString(
        <ActivityTimelineItem event={event} index={3} isLast={false} />,
      )
      expect(html).toContain('timeline-item-3')
    })

    it('renders connecting line when isLast is false', () => {
      const event = makeEvent()
      const html = renderToString(
        <ActivityTimelineItem event={event} index={0} isLast={false} />,
      )
      expect(html).toContain('w-px bg-gray-200')
    })
  })
})
