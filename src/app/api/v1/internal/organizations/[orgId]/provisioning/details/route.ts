import { NextRequest, NextResponse } from 'next/server'
import { TenantProvisioningLog, TenantProvisioningDetail } from '@/lib/models'
import { getAuthUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } },
): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  try {
    const log = await TenantProvisioningLog.findOne({
      where: { organization_id: params.orgId },
      order: [['created_at', 'DESC']],
    })

    if (!log) {
      return NextResponse.json([], { status: 200 })
    }

    const details = await TenantProvisioningDetail.findAll({
      where: { provisioning_log_id: log.id },
      order: [['started_at', 'ASC']],
    })

    return NextResponse.json(details.map((d) => d.toJSON()))
  } catch (err) {
    console.error('[PROVISIONING] Get details error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to fetch provisioning details' }, { status: 500 })
  }
}
