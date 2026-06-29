import { NextRequest, NextResponse } from 'next/server'
import { Framework, FrameworkVersion } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

async function getFrameworkOr404(id: string) {
  const framework = await Framework.findByPk(id, {
    include: [{ model: FrameworkVersion, as: 'versions', required: false }],
  })
  if (!framework) {
    return null
  }
  return framework
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  try {
    const framework = await getFrameworkOr404(params.id)
    if (!framework) {
      return NextResponse.json({ error: 'not_found', message: 'Framework not found' }, { status: 404 })
    }

    const fwJson = framework.toJSON() as unknown as Record<string, unknown>
    const versions = (fwJson.versions as Record<string, unknown>[] | undefined) || []
    const data = {
      ...fwJson,
      version_count: versions.length,
      versions: versions.map((v: Record<string, unknown>) => ({
        id: v.id,
        version_label: v.version_label,
        description: v.description,
        status: v.status,
        effective_date: v.effective_date,
        created_at: v.created_at,
        updated_at: v.updated_at,
      })),
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[FRAMEWORKS] Get error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to get framework' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  let body: { name?: string; description?: string; classification_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  try {
    const framework = await Framework.findByPk(params.id)
    if (!framework) {
      return NextResponse.json({ error: 'not_found', message: 'Framework not found' }, { status: 404 })
    }

    const beforeValues = {
      name: framework.name,
      description: framework.description,
      classification_id: framework.classification_id,
    }

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'Name must be a non-empty string.' }, { status: 400 })
      }
      framework.name = body.name.trim()
    }
    if (body.description !== undefined) {
      framework.description = body.description
    }
    if (body.classification_id !== undefined) {
      framework.classification_id = body.classification_id
    }

    await framework.save()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'framework.update',
      target_type: 'framework',
      target_id: framework.id,
      before_values: beforeValues,
      after_values: { name: framework.name, description: framework.description, classification_id: framework.classification_id },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: framework.toJSON() })
  } catch (err) {
    console.error('[FRAMEWORKS] Update error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to update framework' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  try {
    const framework = await Framework.findByPk(params.id, {
      include: [{ model: FrameworkVersion, as: 'versions', required: false }],
    })
    if (!framework) {
      return NextResponse.json({ error: 'not_found', message: 'Framework not found' }, { status: 404 })
    }

    const fwJson = framework.toJSON() as unknown as Record<string, unknown>
    const versions = (fwJson.versions as Record<string, unknown>[] | undefined) || []
    const hasActiveVersion = versions.some((v: Record<string, unknown>) => v.status === 'active')

    if (hasActiveVersion) {
      return NextResponse.json(
        { error: 'conflict', message: 'Cannot delete framework with active versions. Deprecate all versions first.' },
        { status: 409 },
      )
    }

    await framework.destroy()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'framework.delete',
      target_type: 'framework',
      target_id: params.id,
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: { id: params.id } })
  } catch (err) {
    console.error('[FRAMEWORKS] Delete error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to delete framework' }, { status: 500 })
  }
}
