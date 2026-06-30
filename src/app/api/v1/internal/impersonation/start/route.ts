import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize'
import { sequelize } from '@/lib/sequelize'
import { ImpersonationSession } from '@/lib/models/ImpersonationSession'
import { getAuthUser, requireRoles, AuthError } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

const ALLOWED_ROLES = ['Super Admin', 'Support']
const REASON_MIN_LENGTH = 10
const REASON_MAX_LENGTH = 500
const IMPERSONATION_DURATION_MINUTES = 30

function validateReason(reason: unknown): string | null {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return 'REASON_REQUIRED'
  }
  if (reason.trim().length < REASON_MIN_LENGTH) {
    return 'REASON_TOO_SHORT'
  }
  if (reason.trim().length > REASON_MAX_LENGTH) {
    return 'REASON_TOO_LONG'
  }
  return null
}

async function organizationExists(organizationId: string): Promise<boolean> {
  try {
    const [results] = await sequelize.query(
      'SELECT 1 FROM organizations WHERE id = :id LIMIT 1',
      { replacements: { id: organizationId } },
    )
    return results.length > 0
  } catch {
    return false
  }
}

async function userExistsInOrg(userId: string, organizationId: string): Promise<boolean> {
  try {
    const [results] = await sequelize.query(
      'SELECT 1 FROM users WHERE id = :id AND organization_id = :orgId LIMIT 1',
      { replacements: { id: userId, orgId: organizationId } },
    )
    return results.length > 0
  } catch {
    return false
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireRoles(authUser, ALLOWED_ROLES)
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      if (err.message.startsWith('Required role')) {
        return NextResponse.json(
          { error: 'IMPERSONATION_NOT_AUTHORIZED', message: 'Only Super Admin and Support can start impersonation' },
          { status: 403 },
        )
      }
      return NextResponse.json(
        { error: 'unauthorized', message: err.message },
        { status: err.statusCode },
      )
    }
    return NextResponse.json(
      { error: 'forbidden', message: 'Forbidden' },
      { status: 403 },
    )
  }

  let body: { organization_id?: string; impersonated_user_id?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  const reasonError = validateReason(body.reason)
  if (reasonError) {
    const messages: Record<string, string> = {
      REASON_REQUIRED: 'Reason is required (10-500 characters)',
      REASON_TOO_SHORT: `Reason must be at least ${REASON_MIN_LENGTH} characters`,
      REASON_TOO_LONG: `Reason must not exceed ${REASON_MAX_LENGTH} characters`,
    }
    return NextResponse.json(
      { error: reasonError, message: messages[reasonError] },
      { status: 400 },
    )
  }

  if (!body.organization_id || typeof body.organization_id !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'organization_id is required.' },
      { status: 400 },
    )
  }

  let orgExists: boolean
  try {
    orgExists = await organizationExists(body.organization_id)
  } catch {
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to validate organization' },
      { status: 500 },
    )
  }

  if (!orgExists) {
    return NextResponse.json(
      { error: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found' },
      { status: 404 },
    )
  }

  if (body.impersonated_user_id) {
    let userInOrg: boolean
    try {
      userInOrg = await userExistsInOrg(body.impersonated_user_id, body.organization_id)
    } catch {
      return NextResponse.json(
        { error: 'internal_error', message: 'Failed to validate user' },
        { status: 500 },
      )
    }

    if (!userInOrg) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND_IN_ORG', message: 'User not found in organization' },
        { status: 404 },
      )
    }
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  let session: ImpersonationSession
  try {
    session = await ImpersonationSession.create({
      id: uuidv4(),
      actor_internal_user_id: authUser.id,
      organization_id: body.organization_id,
      impersonated_user_id: body.impersonated_user_id || null,
      reason: body.reason!.trim(),
      started_at: new Date(),
      expires_at: new Date(Date.now() + IMPERSONATION_DURATION_MINUTES * 60 * 1000),
      status: 'active',
      metadata: {},
    } as ImpersonationSession)
  } catch (err: unknown) {
    if (err instanceof Error && 'name' in err && (err as { name: string }).name === 'UniqueConstraintError') {
      return NextResponse.json(
        { error: 'IMPERSONATION_ALREADY_ACTIVE', message: 'An impersonation session is already active for this user' },
        { status: 409 },
      )
    }
    console.error('[IMPERSONATION] Failed to create session:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to create impersonation session' },
      { status: 500 },
    )
  }

  writeAuditEvent({
    actor_internal_user_id: authUser.id,
    actor_role: authUser.roleName,
    action: 'impersonation.start',
    target_type: 'impersonation_session',
    target_id: session.id,
    organization_id: body.organization_id,
    reason: body.reason!.trim(),
    ip_address: ip,
    user_agent: userAgent,
  })

  return NextResponse.json(
    {
      session_id: session.id,
      expires_at: session.expires_at.toISOString(),
      organization_id: session.organization_id,
      impersonated_user_id: session.impersonated_user_id,
      status: session.status,
    },
    { status: 201 },
  )
}
