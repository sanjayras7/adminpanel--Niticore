import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { requirePermission } from '@/lib/auth/requirePermission'
import { InternalAuditEvent } from '@/lib/models'
import { formatAuditEvent } from '@/lib/audit-event-formatter'
import type { InternalSessionUser } from '@/lib/auth/session'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

async function handler(req: NextRequest, ctx: { internalUser: InternalSessionUser }): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const leadId = searchParams.get('lead_id')
  const organizationId = searchParams.get('organization_id')
  const limitParam = searchParams.get('limit')
  const cursor = searchParams.get('cursor')

  const hasLead = leadId !== null && leadId !== ''
  const hasOrg = organizationId !== null && organizationId !== ''

  if ((hasLead && hasOrg) || (!hasLead && !hasOrg)) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Provide exactly one of lead_id or organization_id.' },
      { status: 400 },
    )
  }

  const idToUse = hasLead ? leadId! : organizationId!
  if (!UUID_RE.test(idToUse)) {
    return NextResponse.json(
      { error: 'invalid_request', message: `${hasLead ? 'lead_id' : 'organization_id'} must be a valid UUID.` },
      { status: 400 },
    )
  }

  const limit = Math.min(Math.max(parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)

  const whereClause: Record<string, unknown> = {}
  if (hasLead) {
    whereClause.lead_id = idToUse
  } else {
    whereClause.organization_id = idToUse
  }

  if (cursor) {
    const cursorDate = new Date(cursor)
    if (isNaN(cursorDate.getTime())) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'cursor must be a valid ISO8601 timestamp.' },
        { status: 400 },
      )
    }
    whereClause.created_at = { [Op.lt]: cursorDate }
  }

  let events: InternalAuditEvent[]
  try {
    events = await InternalAuditEvent.findAll({
      where: whereClause,
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit: limit + 1,
    })
  } catch (err) {
    console.error('[AUDIT] Database error querying timeline:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  const hasMore = events.length > limit
  if (hasMore) {
    events = events.slice(0, limit)
  }

  let formatted: Array<Record<string, unknown>>
  try {
    formatted = events.map((e) => ({
      id: e.id,
      actor: {
        id: e.actor_internal_user_id,
        role: e.actor_role ?? 'unknown',
      },
      action: e.action,
      description: formatAuditEvent(e),
      target: {
        type: e.target_type,
        id: e.target_id,
      },
      organizationId: e.organization_id,
      leadId: e.lead_id,
      beforeValues: e.before_values,
      afterValues: e.after_values,
      reason: e.reason,
      metadata: e.metadata,
      createdAt: e.created_at.toISOString(),
    }))
  } catch (err) {
    console.error('[AUDIT] Formatter error:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  const nextCursor = hasMore && events.length > 0
    ? events[events.length - 1].created_at.toISOString()
    : null

  return NextResponse.json({
    events: formatted,
    nextCursor,
  })
}

export const GET = requirePermission('audit', 'read')(handler)
