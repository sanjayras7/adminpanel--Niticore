import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { ImpersonationSession } from '@/lib/models/ImpersonationSession'

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

export async function validateAndClearImpersonationSession(
  actorInternalUserId: string,
): Promise<void> {
  const session = await ImpersonationSession.findOne({
    where: {
      actor_internal_user_id: actorInternalUserId,
      status: 'active',
    },
  })

  if (!session) return

  if (new Date() > session.expires_at) {
    session.status = 'expired'
    session.ended_at = new Date()
    await session.save()
  }
}

export async function checkImpersonationBlock(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!MUTATING_METHODS.includes(request.method)) return null

  const userId = request.headers.get('x-internal-user-id')
  if (!userId) return null

  const session = await getActiveImpersonationSession(userId)
  if (!session) return null

  return NextResponse.json(
    {
      error: 'IMPERSONATION_READ_ONLY',
      message: 'Mutations are blocked during impersonation',
      session_expires_at: session.expires_at.toISOString(),
    },
    { status: 403 },
  )
}
