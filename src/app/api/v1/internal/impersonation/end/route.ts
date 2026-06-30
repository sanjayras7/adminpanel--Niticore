import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, AuthError } from '@/lib/auth'
import { validateAndClearImpersonationSession, getActiveImpersonationSession } from '@/lib/middleware/impersonation'
import { writeAuditEvent } from '@/lib/audit'

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

  await validateAndClearImpersonationSession(authUser.id)

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  let session
  try {
    session = await getActiveImpersonationSession(authUser.id)
  } catch {
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to check impersonation status' },
      { status: 500 },
    )
  }

  if (!session) {
    return NextResponse.json(
      { error: 'NO_ACTIVE_IMPERSONATION', message: 'No active impersonation session' },
      { status: 400 },
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

  writeAuditEvent({
    actor_internal_user_id: authUser.id,
    actor_role: authUser.roleName,
    action: 'impersonation.end',
    target_type: 'impersonation_session',
    target_id: session.id,
    organization_id: session.organization_id,
    reason: null,
    ip_address: ip,
    user_agent: userAgent,
  })

  return NextResponse.json({
    status: 'ended',
    ended_at: session.ended_at.toISOString(),
  })
}
