import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { TenantFrameworkConfig, Framework, FrameworkVersion } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

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
    const configs = await TenantFrameworkConfig.findAll({
      where: { organization_id: params.orgId, is_active: true },
      include: [
        { model: Framework, as: 'framework', required: false },
        { model: FrameworkVersion, as: 'frameworkVersion', required: false },
      ],
      order: [['assigned_at', 'DESC']],
    })

    const data = configs.map((cfg) => {
      const json = cfg.toJSON() as unknown as Record<string, unknown>
      return {
        id: json.id,
        organization_id: json.organization_id,
        framework: json.framework || null,
        framework_version: json.frameworkVersion || null,
        is_active: json.is_active,
        assigned_by: json.assigned_by,
        assigned_at: json.assigned_at,
        deactivated_at: json.deactivated_at,
        deactivated_by: json.deactivated_by,
      }
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[TENANT_FRAMEWORKS] List error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to list tenant framework configs' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  let body: { framework_id?: string; framework_version_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.framework_id || typeof body.framework_id !== 'string') {
    return NextResponse.json({ error: 'invalid_request', message: 'framework_id is required.' }, { status: 400 })
  }
  if (!body.framework_version_id || typeof body.framework_version_id !== 'string') {
    return NextResponse.json({ error: 'invalid_request', message: 'framework_version_id is required.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const version = await FrameworkVersion.findByPk(body.framework_version_id, {
      include: [{ model: Framework, as: 'framework' }],
    })
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Framework version not found' }, { status: 404 })
    }
    if (version.status !== 'active') {
      return NextResponse.json({ error: 'invalid_version', message: 'Only active versions can be assigned' }, { status: 400 })
    }
    if (version.framework_id !== body.framework_id) {
      return NextResponse.json({ error: 'version_mismatch', message: 'Version does not belong to the specified framework' }, { status: 400 })
    }

    const framework = await Framework.findByPk(body.framework_id)
    if (!framework) {
      return NextResponse.json({ error: 'not_found', message: 'Framework not found' }, { status: 404 })
    }

    const existingActive = await TenantFrameworkConfig.findOne({
      where: {
        organization_id: params.orgId,
        framework_id: body.framework_id,
        framework_version_id: body.framework_version_id,
        is_active: true,
      },
    })
    if (existingActive) {
      return NextResponse.json(
        { error: 'conflict', message: 'Tenant already has an active config for this framework version' },
        { status: 409 },
      )
    }

    const config = await TenantFrameworkConfig.create({
      id: uuidv4(),
      organization_id: params.orgId,
      framework_id: body.framework_id,
      framework_version_id: body.framework_version_id,
      is_active: true,
      assigned_by: authUser.id,
      assigned_at: new Date(),
    } as TenantFrameworkConfig)

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'tenant_framework_config.create',
      target_type: 'tenant_framework_config',
      target_id: config.id,
      organization_id: params.orgId,
      after_values: { framework_id: body.framework_id, framework_version_id: body.framework_version_id, is_active: true },
      ip_address: ip,
      user_agent: userAgent,
    })

    const result = config.toJSON() as unknown as Record<string, unknown>
    return NextResponse.json({ data: { ...result, framework: framework.toJSON(), framework_version: version.toJSON() } }, { status: 201 })
  } catch (err) {
    console.error('[TENANT_FRAMEWORKS] Create error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to assign framework to tenant' }, { status: 500 })
  }
}
