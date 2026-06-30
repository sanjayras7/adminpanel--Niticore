import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requirePermission } from '@/lib/auth'
import { Organization, TenantProvisioningLog, TenantProvisioningDetail } from '@/lib/models'

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requirePermission(authUser, 'support.read.provisioning_logs')
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  const { orgId } = params

  try {
    const org = await Organization.findByPk(orgId)
    if (!org) {
      return NextResponse.json({ error: 'not_found', message: 'Tenant not found' }, { status: 404 })
    }

    const logs = await TenantProvisioningLog.findAll({
      where: { organization_id: orgId },
      include: [{ model: TenantProvisioningDetail, as: 'details' }],
      order: [['created_at', 'DESC']],
      limit: 50,
    })

    return NextResponse.json({
      logs: logs.map((log) => {
        const json = log.toJSON() as Record<string, unknown>
        const details = json.details as Record<string, unknown>[] | undefined
        return {
          id: json.id,
          status: json.status,
          error_message: json.error_message,
          started_at: json.started_at,
          completed_at: json.completed_at,
          details: (details || []).map((d) => ({
            table_name: d.table_name,
            status: d.status,
            error_message: d.error_message,
            rows_created: d.rows_created,
            started_at: d.started_at,
            completed_at: d.completed_at,
          })),
        }
      }),
    })
  } catch (err) {
    console.error('[TENANT_LOGS] Error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to load provisioning logs' }, { status: 500 })
  }
}
