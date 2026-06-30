import { NextRequest, NextResponse } from 'next/server'
import { sequelize } from '@/lib/sequelize'
import { TenantFrameworkConfig } from '@/lib/models'
import { getAuthUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string; configId: string } },
): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  try {
    const config = await TenantFrameworkConfig.findByPk(params.configId)
    if (!config) {
      return NextResponse.json({ error: 'not_found', message: 'Tenant framework config not found' }, { status: 404 })
    }
    if (config.organization_id !== params.orgId) {
      return NextResponse.json({ error: 'not_found', message: 'Tenant framework config not found' }, { status: 404 })
    }

    const [events] = await sequelize.query(
      `SELECT
        id, action, actor_internal_user_id, actor_role,
        before_values, after_values, reason, created_at
       FROM internal_audit_events
       WHERE target_type = 'tenant_framework_config'
         AND target_id = :configId
       ORDER BY created_at DESC`,
      {
        replacements: { configId: params.configId },
      },
    )

    return NextResponse.json({ data: events })
  } catch (err) {
    console.error('[TENANT_FRAMEWORKS] History error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to fetch config history' }, { status: 500 })
  }
}
