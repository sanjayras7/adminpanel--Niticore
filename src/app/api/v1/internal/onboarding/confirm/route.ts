import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Lead } from '@/lib/models/Lead'
import { requirePermission } from '@/lib/auth/requirePermission'
import { logAuditEvent } from '@/lib/audit'
import { niticore_onboard_organization } from '@/lib/onboard-organization'
import { sequelize } from '@/lib/sequelize'
import { sendMagicLinkEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limiter'
import type { InternalSessionUser } from '@/lib/auth/session'

interface ConfirmRequest {
  leadId: string
  organizationId: string
  sendAdminInvite: boolean
  overrideReason?: string
}

async function checkContractGate(
  organizationId: string,
  overrideReason?: string,
): Promise<{ passed: boolean; status: string; documentRef: string | null; overriddenBy: string | null; error?: string }> {
  const docResult = await sequelize.query(
    `SELECT platform_status, storage_key FROM legal_documents
     WHERE organization_id = :organizationId
       AND document_type = 'contract'
       AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    { replacements: { organizationId }, type: 'SELECT' },
  )

  const rows = docResult as Array<{ platform_status: string; storage_key: string | null }>
  const latestDoc = rows[0] || null

  if (latestDoc && latestDoc.platform_status === 'signed') {
    return { passed: true, status: 'signed', documentRef: latestDoc.storage_key, overriddenBy: null }
  }

  const overrideResult = await sequelize.query(
    `SELECT overridden_by, reason FROM gate_overrides
     WHERE organization_id = :organizationId
       AND gate_type = 'contract'
     ORDER BY created_at DESC
     LIMIT 1`,
    { replacements: { organizationId }, type: 'SELECT' },
  )

  const overrideRows = overrideResult as Array<{ overridden_by: string; reason: string }>
  const activeOverride = overrideRows[0] || null

  if (activeOverride) {
    if (!overrideReason) {
      return {
        passed: false,
        status: 'overridden_requires_reason',
        documentRef: null,
        overriddenBy: activeOverride.overridden_by,
        error: 'An override exists for this gate, but overrideReason is required to proceed.',
      }
    }
    return { passed: true, status: 'overridden', documentRef: null, overriddenBy: activeOverride.overridden_by }
  }

  return {
    passed: false,
    status: 'not_signed',
    documentRef: null,
    overriddenBy: null,
    error: 'A signed contract is required before provisioning. Add a gate override or wait for the contract to be signed.',
  }
}

async function checkDuplicateProvision(organizationId: string): Promise<boolean> {
  const existingResult = await sequelize.query(
    `SELECT id FROM tenant_provisioning_log
     WHERE organization_id = :organizationId AND status = 'completed'
     LIMIT 1`,
    { replacements: { organizationId }, type: 'SELECT' },
  )
  const existingRows = existingResult as Array<{ id: string }>
  return existingRows.length > 0
}

async function sendAdminInviteFlow(organizationId: string): Promise<boolean> {
  try {
    const adminResult = await sequelize.query(
      `SELECT work_email FROM leads
       WHERE converted_organization_id = :organizationId
         AND deleted_at IS NULL
       LIMIT 1`,
      { replacements: { organizationId }, type: 'SELECT' },
    ) as Array<{ work_email: string }>

    const leadEmail = adminResult[0]?.work_email

    if (leadEmail) {
      const token = uuidv4()
      const otp = String(Math.floor(100000 + Math.random() * 900000))

      await sequelize.query(
        `INSERT INTO organization_admin_invites (id, organization_id, email, token, otp, status, created_at)
         VALUES (:id, :organizationId, :email, :token, :otp, 'sent', NOW())`,
        {
          replacements: {
            id: uuidv4(),
            organizationId,
            email: leadEmail,
            token,
            otp,
          },
          type: 'INSERT',
        },
      )

      await sendMagicLinkEmail(leadEmail, token, otp)
      return true
    }

    return false
  } catch (err) {
    console.error('[ONBOARDING] Invite send failed:', err)
    return false
  }
}

const CONFIRM_ALLOWED_ROLES = ['Super Admin', 'Implementation Manager']

async function handler(
  request: NextRequest,
  { internalUser }: { internalUser: InternalSessionUser },
): Promise<NextResponse> {
  if (!CONFIRM_ALLOWED_ROLES.includes(internalUser.roleName)) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only Super Admin and Implementation Manager can confirm provisioning.' },
      { status: 403 },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  if (!checkRateLimit(`onboarding:confirm:${ip}`).allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
      { status: 429 },
    )
  }

  let body: ConfirmRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.leadId || typeof body.leadId !== 'string') {
    return NextResponse.json({ error: 'invalid_request', message: 'leadId is required.' }, { status: 400 })
  }
  if (!body.organizationId || typeof body.organizationId !== 'string') {
    return NextResponse.json({ error: 'invalid_request', message: 'organizationId is required.' }, { status: 400 })
  }

  try {
    const leadCheck = await sequelize.query(
      `SELECT id, converted_organization_id FROM leads
       WHERE id = :leadId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { leadId: body.leadId }, type: 'SELECT' },
    ) as Array<{ id: string; converted_organization_id: string | null }>

    if (leadCheck.length === 0) {
      return NextResponse.json({ error: 'not_found', message: 'Lead not found for the given leadId.' }, { status: 404 })
    }

    if (leadCheck[0].converted_organization_id !== body.organizationId) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'leadId and organizationId do not match.' },
        { status: 400 },
      )
    }

    const orgCheck = await sequelize.query(
      `SELECT id FROM organizations WHERE id = :orgId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { orgId: body.organizationId }, type: 'SELECT' },
    ) as Array<{ id: string }>

    if (orgCheck.length === 0) {
      return NextResponse.json({ error: 'not_found', message: 'Organization not found for the given organizationId.' }, { status: 404 })
    }

    const isDuplicate = await checkDuplicateProvision(body.organizationId)
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'conflict', message: 'Organization has already been provisioned.' },
        { status: 409 },
      )
    }

    const gateCheck = await checkContractGate(body.organizationId, body.overrideReason)
    if (!gateCheck.passed) {
      return NextResponse.json(
        {
          error: 'gate_blocked',
          gate: 'contract_required',
          message: gateCheck.error,
        },
        { status: 403 },
      )
    }

    const lead = await Lead.findByPk(body.leadId)
    if (!lead) {
      return NextResponse.json({ error: 'not_found', message: 'Lead not found.' }, { status: 404 })
    }

    const provisioningLogId = uuidv4()
    let tenantHash: string

    try {
      await sequelize.query(
        `INSERT INTO tenant_provisioning_log (id, organization_id, status, started_at, created_at)
         VALUES (:id, :organizationId, 'in_progress', NOW(), NOW())`,
        { replacements: { id: provisioningLogId, organizationId: body.organizationId }, type: 'INSERT' },
      )

      tenantHash = await niticore_onboard_organization({
        company_name: lead.company_name,
        contact_first_name: lead.contact_first_name,
        contact_last_name: lead.contact_last_name,
        work_email: lead.work_email,
        company_domain: lead.company_domain,
        region: lead.region,
        company_size: lead.company_size,
        interested_modules_json: lead.interested_modules_json,
        interested_frameworks_json: lead.interested_frameworks_json,
      })

      await sequelize.query(
        `UPDATE tenant_provisioning_log SET status = 'completed', tenant_hash = :tenantHash, completed_at = NOW()
         WHERE id = :id`,
        { replacements: { id: provisioningLogId, tenantHash }, type: 'UPDATE' },
      )
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown provisioning error'

      await sequelize.query(
        `UPDATE tenant_provisioning_log SET status = 'failed', error_message = :errorMsg, completed_at = NOW()
         WHERE id = :id`,
        { replacements: { id: provisioningLogId, errorMsg }, type: 'UPDATE' },
      )

      throw err
    }

    let inviteSent = false
    if (body.sendAdminInvite) {
      inviteSent = await sendAdminInviteFlow(body.organizationId)
    }

    try {
      await logAuditEvent({
        actorInternalUserId: internalUser.id,
        actorRole: internalUser.roleName,
        action: 'onboarding.confirm',
        targetType: 'organization',
        targetId: body.organizationId,
        organizationId: body.organizationId,
        leadId: body.leadId,
        afterValues: {
          provisioningLogId,
          tenantHash,
          inviteSent,
          gateStatus: gateCheck.status,
        },
        reason: body.overrideReason || null,
        ipAddress: ip,
        userAgent,
      })
    } catch (err) {
      console.error('[ONBOARDING] Audit write failed:', err)
    }

    return NextResponse.json(
      {
        success: true,
        organizationId: body.organizationId,
        tenantHash,
        provisioningLogId,
        inviteSent,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[ONBOARDING] Confirm error:', err)
    const correlationId = uuidv4()
    console.error(`[ONBOARDING] Correlation ID: ${correlationId}`)

    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'Provisioning failed. Check the provisioning log for details.',
        correlationId,
      },
      { status: 500 },
    )
  }
}

export const POST = requirePermission('onboarding', 'create')(handler)
