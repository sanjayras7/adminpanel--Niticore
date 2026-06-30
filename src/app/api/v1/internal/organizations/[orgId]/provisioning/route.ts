import { NextRequest, NextResponse } from 'next/server'
import { TenantProvisioningLog } from '@/lib/models'
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
      return NextResponse.json(null, { status: 200 })
    }

    return NextResponse.json(log.toJSON())
  } catch (err) {
    console.error('[PROVISIONING] Get log error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to fetch provisioning log' }, { status: 500 })
  }
}
