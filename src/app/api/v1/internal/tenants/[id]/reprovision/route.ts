import { NextRequest, NextResponse } from 'next/server'
import { sequelize } from '@/lib/sequelize'
import { getAuthUser } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

const ALLOWED_ROLES = ['Super Admin', 'Engineering']

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  if (!authUser.roleName || !ALLOWED_ROLES.includes(authUser.roleName)) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only Engineering and Super Admin can retry provisioning' },
      { status: 403 },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const [result] = await sequelize.query(
      'SELECT * FROM niticore_reprovision_tenant(:tenant_id)',
      { replacements: { tenant_id: params.id } },
    )

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'tenant.reprovision',
      target_type: 'tenant',
      target_id: params.id,
      after_values: { outcome: 'success' },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: result })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'tenant.reprovision',
      target_type: 'tenant',
      target_id: params.id,
      after_values: { outcome: 'failed', error: errorMessage },
      ip_address: ip,
      user_agent: userAgent,
    })

    console.error('[PROVISIONING] Reprovision error:', err)
    return NextResponse.json({ error: 'reprovision_failed', message: errorMessage }, { status: 500 })
  }
}
