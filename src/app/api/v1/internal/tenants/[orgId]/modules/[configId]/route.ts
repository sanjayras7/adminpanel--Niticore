import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
import { sequelize } from '@/lib/sequelize'

const ALLOWED_ROLES = ['Super Admin', 'Implementation Manager']

function isAuthorizedRole(roleName: string | null): boolean {
  return roleName !== null && ALLOWED_ROLES.includes(roleName)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orgId: string; configId: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  if (!isAuthorizedRole(authUser.roleName)) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only Super Admin and Implementation Manager may toggle module configuration' },
      { status: 403 },
    )
  }

  let body: { enabled?: boolean; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'enabled is required and must be a boolean.' },
      { status: 422 },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const [orgRows] = await sequelize.query<{ id: string }[]>(
      `SELECT id FROM organizations WHERE id = :organizationId AND status = 'active'`,
      {
        replacements: { organizationId: params.orgId },
        type: 'SELECT' as never,
      },
    )

    if (orgRows.length === 0) {
      return NextResponse.json(
        { error: 'not_found', message: 'Active organization not found' },
        { status: 404 },
      )
    }

    const [configRows] = await sequelize.query<Record<string, unknown>[]>(
      `SELECT * FROM organization_module_config WHERE id = :configId AND organization_id = :organizationId`,
      {
        replacements: { configId: params.configId, organizationId: params.orgId },
        type: 'SELECT' as never,
      },
    )

    if (configRows.length === 0) {
      return NextResponse.json(
        { error: 'not_found', message: 'Module configuration not found' },
        { status: 404 },
      )
    }

    const config = configRows[0]
    const beforeValues = { enabled: config.enabled }

    await sequelize.query(
      `UPDATE organization_module_config SET enabled = :enabled WHERE id = :configId AND organization_id = :organizationId`,
      {
        replacements: {
          enabled: body.enabled,
          configId: params.configId,
          organizationId: params.orgId,
        },
        type: 'UPDATE' as never,
      },
    )

    const afterValues = { enabled: body.enabled }

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'tenant_module_toggle',
      target_type: 'organization_module_config',
      target_id: params.configId,
      organization_id: params.orgId,
      before_values: beforeValues as unknown as Record<string, unknown>,
      after_values: afterValues as unknown as Record<string, unknown>,
      reason: body.reason ?? null,
      ip_address: ip,
      user_agent: userAgent,
    })

    const updatedConfig = {
      ...config,
      enabled: body.enabled,
    }

    return NextResponse.json({ data: updatedConfig })
  } catch (err) {
    console.error('[TENANT MODULES] Toggle error:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to toggle module configuration' },
      { status: 500 },
    )
  }
}
