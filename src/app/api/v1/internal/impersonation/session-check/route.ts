import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { ImpersonationSession } from '@/lib/models/ImpersonationSession'
import { getActiveImpersonationSession } from '@/lib/middleware/impersonation'
import { writeAuditEvent } from '@/lib/audit'

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

      writeAuditEvent({
        actor_internal_user_id: userId,
        actor_role: null,
        action: 'impersonation.expired',
        target_type: 'impersonation_session',
        target_id: expiredSession.id,
        organization_id: expiredSession.organization_id,
        reason: null,
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
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
