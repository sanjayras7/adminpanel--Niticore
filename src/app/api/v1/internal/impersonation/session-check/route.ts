import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { ImpersonationSession } from '@/lib/models/ImpersonationSession'
import { InternalUser, InternalRole } from '@/lib/models'
import { getActiveImpersonationSession } from '@/lib/middleware/impersonation'
import { logAuditEvent } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-internal-user-id')
  if (!userId) {
    return NextResponse.json({ active: false })
  }

  try {
    const expiredSession = await ImpersonationSession.findOne({
      where: {
        actor_internal_user_id: userId,
        status: 'active',
        expires_at: { [Op.lte]: new Date() },
      },
    })

    if (expiredSession) {
      expiredSession.status = 'expired'
      expiredSession.ended_at = new Date()
      await expiredSession.save()

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
        targetId: expiredSession.id,
        organizationId: expiredSession.organization_id,
        reason: null,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
      })
    }

    const session = await getActiveImpersonationSession(userId)
    if (session) {
      return NextResponse.json({
        active: true,
        expires_at: session.expires_at.toISOString(),
        organization_id: session.organization_id,
        impersonated_user_id: session.impersonated_user_id,
      })
    }

    return NextResponse.json({ active: false })
  } catch (err) {
    console.error('[IMPERSONATION] Session check error:', err)
    return NextResponse.json({ active: false })
  }
}
