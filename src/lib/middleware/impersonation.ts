import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { ImpersonationSession } from '@/lib/models/ImpersonationSession'
import { writeAuditEvent } from '@/lib/audit'

const MUTATING_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE']

export async function getActiveImpersonationSession(
  actorInternalUserId: string,
): Promise<ImpersonationSession | null> {
  return ImpersonationSession.findOne({
    where: {
      actor_internal_user_id: actorInternalUserId,
      status: 'active',
      expires_at: { [Op.gt]: new Date() },
    },
  })
}

export async function checkImpersonationBlock(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!MUTATING_METHODS.includes(request.method)) return null

  const userId = request.headers.get('x-internal-user-id')
  if (!userId) return null

  const session = await ImpersonationSession.findOne({
    where: {
      actor_internal_user_id: userId,
      status: 'active',
    },
  })

  if (!session) return null

  if (new Date() > session.expires_at) {
    session.status = 'expired'
    session.ended_at = new Date()
    await session.save()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    writeAuditEvent({
      actor_internal_user_id: userId,
      actor_role: null,
      action: 'impersonation.expired',
      target_type: 'impersonation_session',
      target_id: session.id,
      organization_id: session.organization_id,
      reason: null,
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json(
      {
        error: 'IMPERSONATION_READ_ONLY',
        message: 'Impersonation session has expired',
        session_expires_at: session.expires_at.toISOString(),
      },
      { status: 403 },
    )
  }

  return NextResponse.json(
    {
      error: 'IMPERSONATION_READ_ONLY',
      message: 'Mutations are blocked during impersonation',
      session_expires_at: session.expires_at.toISOString(),
    },
    { status: 403 },
  )
}
