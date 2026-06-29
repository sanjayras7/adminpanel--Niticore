import { NextRequest, NextResponse } from 'next/server'
import { Lead } from '@/lib/models/Lead'
import { requirePermission } from '@/lib/auth/requirePermission'
import { logAuditEvent } from '@/lib/audit'
import { isValidStatus, isSameStatus, validateTransition } from '@/lib/lead-status'
import type { InternalSessionUser } from '@/lib/auth/session'

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handler(
  request: NextRequest,
  { internalUser }: { internalUser: InternalSessionUser },
): Promise<NextResponse> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  const idIndex = pathParts.indexOf('leads') + 1
  const leadId = pathParts[idIndex]

  if (!leadId || !VALID_UUID.test(leadId)) {
    return NextResponse.json(
      { error: 'invalid_lead_id', message: 'Invalid lead ID format.' },
      { status: 400 },
    )
  }

  let body: { status?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (typeof body.status !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Status is required.' },
      { status: 400 },
    )
  }

  if (body.status === '' || !isValidStatus(body.status)) {
    return NextResponse.json(
      {
        error: 'invalid_status',
        message: `Invalid status. Must be one of: ${['New', 'Contacted', 'Engaged', 'Negotiation', 'Converted_to_Tenant', 'Disqualified', 'Archived'].join(', ')}`,
      },
      { status: 422 },
    )
  }

  const nextStatus = body.status

  let lead: Lead | null
  try {
    lead = await Lead.findByPk(leadId)
  } catch (err) {
    console.error('[LEAD_STATUS] Database error during lead lookup:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (!lead || lead.deleted_at !== null) {
    return NextResponse.json(
      { error: 'not_found', message: 'Lead not found.' },
      { status: 404 },
    )
  }

  if (!isValidStatus(lead.status)) {
    return NextResponse.json(
      { error: 'server_error', message: 'Lead has an unrecognized status.' },
      { status: 500 },
    )
  }

  const currentStatus = lead.status
  const { valid, allowedNext } = validateTransition(currentStatus, nextStatus)

  if (!valid) {
    return NextResponse.json(
      {
        error: 'invalid_transition',
        message: `Cannot transition from '${currentStatus}' to '${nextStatus}'. Allowed next statuses: ${allowedNext.join(', ') || '(none)'}.`,
        current_status: currentStatus,
        requested_status: nextStatus,
        allowed_next_statuses: allowedNext,
      },
      { status: 422 },
    )
  }

  if (isSameStatus(currentStatus, nextStatus)) {
    return NextResponse.json({
      id: lead.id,
      status: lead.status,
      updatedAt: lead.updated_at,
    })
  }

  try {
    lead.status = nextStatus
    lead.updated_at = new Date()
    await lead.save()
  } catch (err) {
    console.error('[LEAD_STATUS] Database error during status update:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to update lead status.' },
      { status: 500 },
    )
  }

  try {
    await logAuditEvent({
      actorInternalUserId: internalUser.id,
      actorRole: internalUser.roleName,
      action: 'lead.status_changed',
      targetType: 'lead',
      targetId: lead.id,
      leadId: lead.id,
      beforeValues: { status: currentStatus },
      afterValues: { status: nextStatus },
      reason: body.reason || null,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent') || null,
    })
  } catch (err) {
    console.error('[LEAD_STATUS] Failed to write audit event:', err)
  }

  return NextResponse.json({
    id: lead.id,
    status: lead.status,
    updatedAt: lead.updated_at,
  })
}

export const PATCH = requirePermission('leads', 'update')(handler)
