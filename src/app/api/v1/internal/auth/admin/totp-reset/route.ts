import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { sequelize } from '@/lib/sequelize'
import { InternalUser, InternalAuditEvent } from '@/lib/models'
import { requirePermission } from '@/lib/auth/requirePermission'

interface TotpResetBody {
  internal_user_id?: string
  reason?: string
}

export const POST = requirePermission('auth', 'override')(async (
  request,
  { internalUser },
) => {
  let body: TotpResetBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (!body.internal_user_id || typeof body.internal_user_id !== 'string') {
    return NextResponse.json(
      { error: 'validation_error', message: 'Missing required field: internal_user_id' },
      { status: 422 },
    )
  }

  if (!body.reason || typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    return NextResponse.json(
      { error: 'validation_error', message: 'reason must be a non-empty string' },
      { status: 422 },
    )
  }

  if (body.internal_user_id === internalUser.id) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Cannot reset your own TOTP. Contact another Super Admin.' },
      { status: 403 },
    )
  }

  let targetUser: InternalUser | null = null
  try {
    targetUser = await InternalUser.findByPk(body.internal_user_id)
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to reset TOTP. Please retry.' },
      { status: 500 },
    )
  }

  if (!targetUser) {
    return NextResponse.json(
      { error: 'not_found', message: 'User not found' },
      { status: 404 },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || null

  try {
    await sequelize.transaction(async (t) => {
      const beforeValues = {
        totp_enabled: targetUser.totp_enabled,
        totp_secret_encrypted: targetUser.totp_secret_encrypted ? '[redacted]' : null,
      }

      targetUser.totp_enabled = false
      targetUser.totp_secret_encrypted = null
      targetUser.totp_enrolled_at = null
      targetUser.last_totp_verified_at = null
      targetUser.failed_totp_attempt_count = 0
      targetUser.locked_until = null
      targetUser.totp_reset_at = new Date()
      targetUser.totp_reset_by = internalUser.id
      targetUser.totp_reset_reason = body.reason.trim()

      await targetUser.save({ transaction: t })

      await InternalAuditEvent.create(
        {
          id: uuidv4(),
          actor_internal_user_id: internalUser.id,
          actor_role: 'Super Admin',
          action: 'totp_reset',
          target_type: 'internal_user',
          target_id: targetUser.id,
          organization_id: null,
          lead_id: null,
          before_values: beforeValues,
          after_values: {
            totp_enabled: false,
            totp_secret_encrypted: null,
          },
          reason: body.reason.trim(),
          metadata: null,
          ip_address: ip,
          user_agent: userAgent,
          created_at: new Date(),
        },
        { transaction: t },
      )
    })
  } catch (err) {
    console.error('[TOTP_RESET] Transaction failed:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to reset TOTP. Please retry.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    message: 'TOTP enrollment reset. User must re-enroll at next login.',
  })
})
