import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { ImpersonationSession } from '@/lib/models/ImpersonationSession'
import { getAuthUser, AuthError } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
  } catch (err: unknown) {
    const status = err instanceof AuthError ? err.statusCode : 401
    return NextResponse.json(
      { error: 'unauthorized', message: err instanceof Error ? err.message : 'Authentication required' },
      { status },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = request.headers.get('user-agent') || null

  let session
  try {
    session = await ImpersonationSession.findOne({
      where: {
        actor_internal_user_id: authUser.id,
        status: 'active',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to check impersonation status' },
      { status: 500 },
    )
  }

  if (!session) {
    return NextResponse.json(
      { error: 'not_found', message: 'No active impersonation session found' },
      { status: 404 },
    )
  }

  if (authUser.id !== session.actor_internal_user_id && authUser.roleName !== 'Super Admin') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only the session actor or Super Admin may end impersonation' },
      { status: 403 },
    )
  }

  try {
    session.status = 'ended'
    session.ended_at = new Date()
    await session.save()
  } catch {
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to end impersonation session' },
      { status: 500 },
    )
  }

  await logAuditEvent({
    actorInternalUserId: authUser.id,
    actorRole: authUser.roleName ?? 'UNKNOWN',
    action: 'impersonation.end',
    targetType: 'impersonation_session',
    targetId: session.id,
    organizationId: session.organization_id,
    reason: null,
    ipAddress: ip,
    userAgent: userAgent,
  })

  return NextResponse.json({
    data: {
      id: session.id,
      ended_at: session.ended_at.toISOString(),
    },
  })
}
