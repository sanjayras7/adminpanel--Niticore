import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { sequelize } from '@/lib/sequelize'
import { getAuthUser, requireMutationAuth, requirePermission, requireReason } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
import { sendMagicLinkEmail } from '@/lib/email'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_ACTIONS = new Set([
  'resend_invite',
  'reset_onboarding',
  'force_verify_domain',
  'disable_tenant',
  'unlock_user',
])

const ACTION_KEY_MAP: Record<string, string> = {
  resend_invite: 'tenant.resend_invite',
  reset_onboarding: 'tenant.reset_onboarding',
  force_verify_domain: 'tenant.force_verify_domain',
  disable_tenant: 'tenant.disable',
  unlock_user: 'tenant.unlock_user',
}

interface ActionBody {
  reason?: string
  user_id?: string
}

async function getOrgById(organizationId: string): Promise<Record<string, unknown> | null> {
  const [rows] = await sequelize.query(
    `SELECT id, name, status, domain, domain_verified, onboarding_status, tenant_hash
     FROM organizations WHERE id = :id`,
    { replacements: { id: organizationId } },
  )
  const result = rows as Record<string, unknown>[]
  return result.length > 0 ? result[0] : null
}

async function getCustomerUserById(userId: string): Promise<Record<string, unknown> | null> {
  const [rows] = await sequelize.query(
    `SELECT id, name, email, status, organization_id
     FROM customer_users WHERE id = :id`,
    { replacements: { id: userId } },
  )
  const result = rows as Record<string, unknown>[]
  return result.length > 0 ? result[0] : null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { organizationId: string; action: string } },
): Promise<NextResponse> {
  const { organizationId, action } = params

  if (!UUID_REGEX.test(organizationId)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid organization_id format' } },
      { status: 400 },
    )
  }

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` } },
      { status: 400 },
    )
  }

  const actionKey = ACTION_KEY_MAP[action]

  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
    requirePermission(authUser, actionKey)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    const code = status === 403 ? 'UNAUTHORIZED' : 'VALIDATION_ERROR'
    return NextResponse.json(
      { error: { code, message: err instanceof Error ? err.message : 'Forbidden' } },
      { status },
    )
  }

  let body: ActionBody = {}
  try {
    body = await request.json()
  } catch {
  }

  try {
    requireReason(actionKey, body.reason)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 422
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: err instanceof Error ? err.message : 'Reason is required' } },
      { status },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = (request.headers.get('user-agent') || '').substring(0, 512) || undefined

  try {
    const org = await getOrgById(organizationId)
    if (!org) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 },
      )
    }

    const actionHandlers: Record<string, (org: Record<string, unknown>) => Promise<{ message: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }>> = {
      resend_invite: async (orgRecord) => {
        const orgName = orgRecord.name as string
        const orgDomain = orgRecord.domain as string | null

        const [existingUsers] = await sequelize.query(
          `SELECT email FROM customer_users WHERE organization_id = :orgId AND status = 'invited' LIMIT 1`,
          { replacements: { orgId: organizationId } },
        )
        const users = existingUsers as { email: string }[]

        if (users.length === 0) {
          return {
            message: 'No pending invites found for this organization. An invitation will be sent when an admin user is created.',
            before: null,
            after: null,
          }
        }

        const token = uuidv4()
        const otp = Math.floor(100000 + Math.random() * 900000).toString()

        await sequelize.query(
          `UPDATE magic_links SET consumed_at = NOW() WHERE organization_id = :orgId AND purpose = 'invite' AND consumed_at IS NULL`,
          { replacements: { orgId: organizationId } },
        )

        await sequelize.query(
          `INSERT INTO magic_links (id, organization_id, email, token, otp, purpose, expires_at, consumed_at, created_at)
           VALUES (:id, :orgId, :email, :token, :otp, 'invite', NOW() + INTERVAL '7 days', NULL, NOW())`,
          {
            replacements: {
              id: uuidv4(),
              orgId: organizationId,
              email: users[0].email,
              token,
              otp,
            },
          },
        )

        await sendMagicLinkEmail(users[0].email, token, otp)

        return {
          message: `Invitation re-sent to ${users[0].email}`,
          before: null,
          after: { invite_sent_to: users[0].email },
        }
      },

      reset_onboarding: async (orgRecord) => {
        const beforeStatus = (orgRecord.onboarding_status as string) || null

        await sequelize.query(
          `UPDATE organizations SET onboarding_status = 'not_started', updated_at = NOW() WHERE id = :id`,
          { replacements: { id: organizationId } },
        )

        return {
          message: 'Onboarding status has been reset to not_started',
          before: { onboarding_status: beforeStatus },
          after: { onboarding_status: 'not_started' },
        }
      },

      force_verify_domain: async (orgRecord) => {
        const beforeVerified = orgRecord.domain_verified as boolean | null

        await sequelize.query(
          `UPDATE organizations SET domain_verified = TRUE, updated_at = NOW() WHERE id = :id`,
          { replacements: { id: organizationId } },
        )

        return {
          message: 'Domain has been force-verified',
          before: { domain_verified: beforeVerified },
          after: { domain_verified: true },
        }
      },

      disable_tenant: async (orgRecord) => {
        const beforeStatus = orgRecord.status as string | null

        if (beforeStatus === 'disabled') {
          return {
            message: 'Tenant is already disabled',
            before: { status: beforeStatus },
            after: { status: beforeStatus },
          }
        }

        await sequelize.query(
          `UPDATE organizations SET status = 'disabled', updated_at = NOW() WHERE id = :id`,
          { replacements: { id: organizationId } },
        )

        return {
          message: 'Tenant has been disabled',
          before: { status: beforeStatus },
          after: { status: 'disabled' },
        }
      },

      unlock_user: async (orgRecord) => {
        if (!body.user_id || typeof body.user_id !== 'string' || !UUID_REGEX.test(body.user_id)) {
          throw Object.assign(new Error('user_id is required and must be a valid UUID'), { statusCode: 422, code: 'VALIDATION_ERROR' })
        }

        const user = await getCustomerUserById(body.user_id)
        if (!user) {
          throw Object.assign(new Error('User not found'), { statusCode: 404, code: 'NOT_FOUND' })
        }

        if (user.organization_id !== organizationId) {
          throw Object.assign(new Error('User does not belong to this organization'), { statusCode: 409, code: 'CONFLICT' })
        }

        const beforeStatus = user.status as string | null

        if (beforeStatus !== 'locked') {
          return {
            message: 'User is not currently locked',
            before: { user_status: beforeStatus },
            after: { user_status: beforeStatus },
          }
        }

        await sequelize.query(
          `UPDATE customer_users SET status = 'active', failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = :id`,
          { replacements: { id: body.user_id } },
        )

        return {
          message: `User ${user.email} has been unlocked`,
          before: { user_id: body.user_id, user_status: beforeStatus },
          after: { user_id: body.user_id, user_status: 'active' },
        }
      },
    }

    const handler = actionHandlers[action]
    const result = await handler(org)
    const targetId = action === 'unlock_user' && body.user_id ? body.user_id : organizationId
    const targetType = action === 'unlock_user' ? 'customer_user' : 'organization'

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: actionKey,
      target_type: targetType,
      target_id: targetId,
      organization_id: organizationId,
      before_values: result.before,
      after_values: result.after,
      reason: body.reason || null,
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({
      success: true,
      action,
      organization_id: organizationId,
      message: result.message,
    })
  } catch (err: unknown) {
    const e = err as (Error & { statusCode?: number; code?: string })
    const statusCode = e.statusCode || 500
    const code = e.code || 'ACTION_FAILED'
    const message = e.message || 'Action failed'

    if (statusCode === 422 || statusCode === 400) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message } }, { status: statusCode })
    }
    if (statusCode === 404) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message } }, { status: 404 })
    }
    if (statusCode === 409) {
      return NextResponse.json({ error: { code: 'CONFLICT', message } }, { status: 409 })
    }

    console.error(`[TENANT_ACTIONS] ${action} error:`, err)
    return NextResponse.json({ error: { code: 'ACTION_FAILED', message: `Failed to ${action.replace(/_/g, ' ')}` } }, { status: 500 })
  }
}
