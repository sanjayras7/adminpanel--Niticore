import { NextRequest, NextResponse } from 'next/server'
import { sequelize } from '@/lib/sequelize'
import { getAuthUser } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

const ALLOWED_ROLES = ['Super Admin', 'Engineering']

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } },
): Promise<NextResponse> {
  if (!UUID_REGEX.test(params.orgId)) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Tenant ID must be a valid UUID' },
      { status: 400 },
    )
  }

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
      { replacements: { tenant_id: params.orgId } },
    )

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'tenant.reprovision',
      target_type: 'tenant',
      target_id: params.orgId,
      organization_id: params.orgId,
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
      target_id: params.orgId,
      organization_id: params.orgId,
      after_values: { outcome: 'failed', error: errorMessage },
      ip_address: ip,
      user_agent: userAgent,
    })

    console.error('[PROVISIONING] Reprovision error:', err)

    const lowerMsg = errorMessage.toLowerCase()
    if (lowerMsg.includes('not found')) {
      return NextResponse.json({ error: 'not_found', message: errorMessage }, { status: 404 })
    }
    if (lowerMsg.includes('not in a failed') || lowerMsg.includes('invalid state') || lowerMsg.includes('cannot reprovision')) {
      return NextResponse.json({ error: 'conflict', message: errorMessage }, { status: 409 })
    }

    return NextResponse.json({ error: 'reprovision_failed', message: errorMessage }, { status: 500 })
  }
}
