import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requirePermission } from '@/lib/auth'
import { Organization, OrganizationIntegrationIntent } from '@/lib/models'

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requirePermission(authUser, 'support.read.integration_health')
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

    const integIntent = await OrganizationIntegrationIntent.findOne({
      where: { organization_id: orgId },
    })

    const domainVerified = org.domain !== null && org.domain !== ''
    const ssoConfigured = integIntent?.sso_required === true
    const ssoType = integIntent?.sso_provider ?? null

    let overallStatus: 'healthy' | 'degraded' | 'unconfigured' = 'unconfigured'
    if (domainVerified && ssoConfigured) {
      overallStatus = 'healthy'
    } else if (domainVerified || ssoConfigured) {
      overallStatus = 'degraded'
    }

    return NextResponse.json({
      domain_verified: domainVerified,
      domain_verified_at: null,
      sso_configured: ssoConfigured,
      sso_type: ssoType,
      last_health_check_at: null,
      overall_status: overallStatus,
    })
  } catch (err) {
    console.error('[INTEGRATION_HEALTH] Error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to load integration health' }, { status: 500 })
  }
}
