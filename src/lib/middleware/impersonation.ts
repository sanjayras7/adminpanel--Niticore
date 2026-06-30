import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { ImpersonationSession } from '@/lib/models/ImpersonationSession'
import { logAuditEvent } from '@/lib/audit'
import { InternalUser, InternalRole } from '@/lib/models'

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

    let actorRole = 'SYSTEM'
    try {
      const user = await InternalUser.findByPk(userId, {
        include: [{ model: InternalRole, as: 'role' }],
      })
      if (user) {
        const role = user.get('role') as InternalRole | null
        actorRole = role?.name ?? 'SYSTEM'
      }
    } catch {
      console.error('[IMPERSONATION] Failed to look up user role for audit:', userId)
    }

    await logAuditEvent({
      actorInternalUserId: userId,
      actorRole,
      action: 'impersonation.expired',
      targetType: 'impersonation_session',
      targetId: session.id,
      organizationId: session.organization_id,
      reason: null,
      ipAddress: ip || null,
      userAgent: userAgent || null,
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
