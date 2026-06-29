import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { InternalUser, OrganizationAdminInvite } from '@/lib/models'
import { authenticateRequest } from '@/lib/auth'
import { sendAdminInviteEmail } from '@/lib/email'
import { validateAdminBody, AdminRequestBody } from '@/lib/validation'

const INVITE_EXPIRY_DAYS = 7

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authUser = await authenticateRequest(request)
  if (!authUser) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Authentication required' },
      { status: 401 },
    )
  }

  // TODO: Add proper role check when Issue 2b (RBAC middleware) is available.
  // Required role: Implementation Manager or Super Admin.

  let body: AdminRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const validationErrors = validateAdminBody(body)
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', fields: validationErrors },
      { status: 422 },
    )
  }

  const email = body.email!.trim().toLowerCase()
  const name = body.name!.trim()
  const surname = body.surname!.trim()
  const jobTitle = body.job_title?.trim() ?? null
  const organizationId = body.organization_id!
  const inviteTiming = body.invite_timing ?? 'defer'

  let existingUser: InternalUser | null = null
  try {
    existingUser = await InternalUser.findOne({
      where: { email },
      paranoid: false,
    })
  } catch {
    return NextResponse.json(
      { error: 'internal_error', message: 'Database error' },
      { status: 500 },
    )
  }

  if (existingUser) {
    return NextResponse.json(
      {
        error: 'validation_failed',
        fields: { email: 'already_exists' },
      },
      { status: 422 },
    )
  }

  let adminUser: InternalUser
  try {
    adminUser = await InternalUser.create({
      id: uuidv4(),
      name,
      surname,
      email,
      job_title: jobTitle,
      internal_role_id: null,
      status: 'inactive',
      totp_enabled: false,
      totp_secret_encrypted: null,
      totp_enrolled_at: null,
      last_login_at: null,
      last_totp_verified_at: null,
      failed_totp_attempt_count: 0,
      locked_until: null,
      deleted_at: null,
    })
  } catch {
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to create admin user' },
      { status: 500 },
    )
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)

  try {
    await OrganizationAdminInvite.create({
      id: uuidv4(),
      organization_id: organizationId,
      internal_user_id: adminUser.id,
      status: 'pending',
      invited_by: authUser.id,
      expires_at: expiresAt,
    })
  } catch {
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to create invitation' },
      { status: 500 },
    )
  }

  let inviteSent = false
  const warnings: { code: string }[] = []

  if (inviteTiming === 'send_now') {
    try {
      inviteSent = await sendAdminInviteEmail(email, `${name} ${surname}`)
      if (inviteSent) {
        await OrganizationAdminInvite.update(
          { status: 'sent' },
          { where: { internal_user_id: adminUser.id } },
        )
      } else {
        warnings.push({ code: 'invite_email_failed' })
      }
    } catch {
      warnings.push({ code: 'invite_email_failed' })
    }
  }

  const responseBody: { admin_id: string; invite_sent: boolean; warnings?: { code: string }[] } = {
    admin_id: adminUser.id,
    invite_sent: inviteSent,
  }

  if (warnings.length > 0) {
    responseBody.warnings = warnings
  }

  return NextResponse.json(responseBody, { status: 201 })
}
