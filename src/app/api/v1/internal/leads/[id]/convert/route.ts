import { NextRequest, NextResponse } from 'next/server'
import { Lead } from '@/lib/models/Lead'
import { requirePermission } from '@/lib/auth/requirePermission'
import { logAuditEvent } from '@/lib/audit'
import { isValidStatus } from '@/lib/lead-status'
import { niticore_onboard_organization } from '@/lib/onboard-organization'
import { sequelize } from '@/lib/sequelize'
import type { InternalSessionUser } from '@/lib/auth/session'

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const CONVERT_ALLOWED_ROLES = ['Super Admin', 'Implementation Manager']

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

  if (!CONVERT_ALLOWED_ROLES.includes(internalUser.roleName)) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only Super Admin and Implementation Manager can convert leads.' },
      { status: 403 },
    )
  }

  let body: {
    reason?: string
    plan?: string
    billing_ref?: string
    contract_start_date?: string
    contract_end_date?: string
    primary_admin_name?: string
    primary_admin_email?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim() === '') {
    return NextResponse.json(
      { error: 'reason_required', message: 'Reason is required for conversion.' },
      { status: 400 },
    )
  }

  let lead: Lead | null
  try {
    lead = await Lead.findByPk(leadId)
  } catch (err) {
    console.error('[LEAD_CONVERT] Database error during lead lookup:', err)
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

  if (lead.converted_organization_id) {
    return NextResponse.json(
      { error: 'already_converted', message: 'This lead has already been converted to a tenant.' },
      { status: 409 },
    )
  }

  if (!isValidStatus(lead.status)) {
    return NextResponse.json(
      { error: 'server_error', message: 'Lead has an unrecognized status.' },
      { status: 500 },
    )
  }

  if (lead.status !== 'Negotiation') {
    return NextResponse.json(
      {
        error: 'invalid_status',
        message: `Lead must be in 'Negotiation' status to convert. Current status: '${lead.status}'.`,
        current_status: lead.status,
      },
      { status: 422 },
    )
  }

  let organizationId: string
  const previousStatus = lead.status
  try {
    organizationId = await sequelize.transaction(async (t) => {
      const orgId = await niticore_onboard_organization({
        company_name: lead.company_name,
        contact_first_name: lead.contact_first_name,
        contact_last_name: lead.contact_last_name,
        work_email: lead.work_email,
        company_domain: lead.company_domain,
        region: lead.region,
        company_size: lead.company_size,
        interested_modules_json: lead.interested_modules_json,
        interested_frameworks_json: lead.interested_frameworks_json,
        plan: body.plan,
        billing_ref: body.billing_ref,
        contract_start_date: body.contract_start_date,
        contract_end_date: body.contract_end_date,
        primary_admin_name: body.primary_admin_name,
        primary_admin_email: body.primary_admin_email,
      })

      lead.status = 'Converted_to_Tenant'
      lead.converted_organization_id = orgId
      lead.updated_at = new Date()
      await lead.save({ transaction: t })

      return orgId
    })
  } catch (err) {
    console.error('[LEAD_CONVERT] Conversion transaction failed:', err)
    return NextResponse.json(
      { error: 'conversion_failed', message: 'Failed to convert lead to tenant.' },
      { status: 500 },
    )
  }

  try {
    await logAuditEvent({
      actorInternalUserId: internalUser.id,
      actorRole: internalUser.roleName,
      action: 'lead.converted_to_tenant',
      targetType: 'lead',
      targetId: lead.id,
      leadId: lead.id,
      organizationId,
      beforeValues: { status: previousStatus, converted_organization_id: null },
      afterValues: { status: 'Converted_to_Tenant', converted_organization_id: organizationId },
      reason: body.reason,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent') || null,
      metadata: {
        plan: body.plan || null,
        billing_ref: body.billing_ref || null,
        primary_admin_name: body.primary_admin_name || null,
      },
    })
  } catch (err) {
    console.error('[LEAD_CONVERT] Failed to write audit event:', err)
  }

  return NextResponse.json({
    leadId: lead.id,
    organizationId,
    status: 'Converted_to_Tenant',
    prefill: {
      company_name: lead.company_name,
      contact_first_name: lead.contact_first_name,
      contact_last_name: lead.contact_last_name,
      work_email: lead.work_email,
      company_domain: lead.company_domain,
      region: lead.region,
      company_size: lead.company_size,
      interested_modules_json: lead.interested_modules_json,
      interested_frameworks_json: lead.interested_frameworks_json,
      plan: body.plan || null,
      billing_ref: body.billing_ref || null,
      primary_admin_name: body.primary_admin_name || null,
      primary_admin_email: body.primary_admin_email || null,
    },
  })
}

export const POST = requirePermission('leads', 'update')(handler)
