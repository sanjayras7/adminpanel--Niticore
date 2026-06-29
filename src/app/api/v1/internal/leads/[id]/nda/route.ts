import { NextRequest, NextResponse } from 'next/server'
import { Lead } from '@/lib/models/Lead'
import { requirePermission } from '@/lib/auth/requirePermission'
import { logAuditEvent } from '@/lib/audit'
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

  let body: { nda_required?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (typeof body.nda_required !== 'boolean') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'nda_required must be a boolean.' },
      { status: 400 },
    )
  }

  let lead: Lead | null
  try {
    lead = await Lead.findByPk(leadId)
  } catch (err) {
    console.error('[NDA] Database error during lead lookup:', err)
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

  const beforeValue = lead.nda_required
  if (beforeValue === body.nda_required) {
    return NextResponse.json({
      id: lead.id,
      nda_required: lead.nda_required,
      updated_at: lead.updated_at,
    })
  }

  try {
    lead.nda_required = body.nda_required
    lead.updated_at = new Date()
    await lead.save()
  } catch (err) {
    console.error('[NDA] Database error during update:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to update NDA requirement.' },
      { status: 500 },
    )
  }

  try {
    await logAuditEvent({
      actorInternalUserId: internalUser.id,
      actorRole: internalUser.roleName,
      action: 'lead.nda_required_changed',
      targetType: 'lead',
      targetId: lead.id,
      leadId: lead.id,
      beforeValues: { nda_required: beforeValue },
      afterValues: { nda_required: body.nda_required },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent') || null,
    })
  } catch (err) {
    console.error('[NDA] Failed to write audit event:', err)
  }

  return NextResponse.json({
    id: lead.id,
    nda_required: lead.nda_required,
    updated_at: lead.updated_at,
  })
}

export const PATCH = requirePermission('nda-contracts', 'update')(handler)
