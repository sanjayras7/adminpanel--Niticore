import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { TenantFrameworkConfig, Framework, FrameworkVersion } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

export async function PUT(
  request: NextRequest,
  { params }: { params: { orgId: string; configId: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  let body: { framework_version_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.framework_version_id || typeof body.framework_version_id !== 'string') {
    return NextResponse.json({ error: 'invalid_request', message: 'framework_version_id is required.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const config = await TenantFrameworkConfig.findByPk(params.configId, {
      include: [
        { model: Framework, as: 'framework' },
        { model: FrameworkVersion, as: 'frameworkVersion' },
      ],
    })
    if (!config) {
      return NextResponse.json({ error: 'not_found', message: 'Tenant framework config not found' }, { status: 404 })
    }
    if (config.organization_id !== params.orgId) {
      return NextResponse.json({ error: 'not_found', message: 'Tenant framework config not found' }, { status: 404 })
    }
    if (!config.is_active) {
      return NextResponse.json({ error: 'invalid_action', message: 'Cannot update a deactivated config' }, { status: 409 })
    }

    const newVersion = await FrameworkVersion.findByPk(body.framework_version_id)
    if (!newVersion) {
      return NextResponse.json({ error: 'not_found', message: 'Framework version not found' }, { status: 404 })
    }
    if (newVersion.status !== 'active') {
      return NextResponse.json({ error: 'invalid_version', message: 'Only active versions can be assigned' }, { status: 400 })
    }
    if (newVersion.framework_id !== config.framework_id) {
      return NextResponse.json({ error: 'version_mismatch', message: 'Version does not belong to the same framework' }, { status: 400 })
    }

    const existingActive = await TenantFrameworkConfig.findOne({
      where: {
        organization_id: params.orgId,
        framework_id: config.framework_id,
        framework_version_id: body.framework_version_id,
        is_active: true,
        id: { [Op.ne]: params.configId },
      },
    })
    if (existingActive) {
      return NextResponse.json(
        { error: 'conflict', message: 'Tenant already has an active config for this framework version' },
        { status: 409 },
      )
    }

    const beforeValues = {
      framework_version_id: config.framework_version_id,
      is_active: config.is_active,
    }

    config.framework_version_id = body.framework_version_id
    await config.save()

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'tenant_framework_config.update',
      target_type: 'tenant_framework_config',
      target_id: config.id,
      organization_id: params.orgId,
      before_values: beforeValues,
      after_values: { framework_version_id: body.framework_version_id, is_active: true },
      ip_address: ip,
      user_agent: userAgent,
    })

    const result = config.toJSON() as unknown as Record<string, unknown>
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[TENANT_FRAMEWORKS] Update error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to update tenant framework config' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { orgId: string; configId: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const config = await TenantFrameworkConfig.findByPk(params.configId)
    if (!config) {
      return NextResponse.json({ error: 'not_found', message: 'Tenant framework config not found' }, { status: 404 })
    }
    if (config.organization_id !== params.orgId) {
      return NextResponse.json({ error: 'not_found', message: 'Tenant framework config not found' }, { status: 404 })
    }
    if (!config.is_active) {
      return NextResponse.json({ error: 'invalid_action', message: 'Config is already deactivated' }, { status: 409 })
    }

    const beforeValues = {
      framework_version_id: config.framework_version_id,
      is_active: config.is_active,
    }

    config.is_active = false
    config.deactivated_at = new Date()
    config.deactivated_by = authUser.id
    await config.save()

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'tenant_framework_config.deactivate',
      target_type: 'tenant_framework_config',
      target_id: config.id,
      organization_id: params.orgId,
      before_values: beforeValues,
      after_values: { framework_version_id: config.framework_version_id, is_active: false, deactivated_by: authUser.id },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: { id: params.configId, is_active: false } })
  } catch (err) {
    console.error('[TENANT_FRAMEWORKS] Deactivate error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to deactivate tenant framework config' }, { status: 500 })
  }
}
