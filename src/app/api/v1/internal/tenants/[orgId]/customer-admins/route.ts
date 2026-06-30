import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requirePermission } from '@/lib/auth'
import { getCustomerAdmins } from '@/lib/queries/tenant'
import { Organization } from '@/lib/models'

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requirePermission(authUser, 'support.read.customer_admins')
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

    const admins = await getCustomerAdmins(orgId)

    return NextResponse.json({ admins })
  } catch (err) {
    console.error('[CUSTOMER_ADMINS] Error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to load customer admins' }, { status: 500 })
  }
}
