import { NextRequest, NextResponse } from 'next/server'
import { Control, ControlVersion } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

async function getControlOr404(id: string) {
  const control = await Control.findByPk(id, {
    include: [{ model: ControlVersion, as: 'versions', required: false }],
  })
  if (!control) {
    return null
  }
  return control
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
    const control = await getControlOr404(params.id)
    if (!control) {
      return NextResponse.json({ error: 'not_found', message: 'Control not found' }, { status: 404 })
    }

    const ctrlJson = control.toJSON() as unknown as Record<string, unknown>
    const versions = (ctrlJson.versions as Record<string, unknown>[] | undefined) || []
    const data = {
      ...ctrlJson,
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
    console.error('[CONTROLS] Get error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to get control' }, { status: 500 })
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

  let body: { control_code?: string; title?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  try {
    const control = await Control.findByPk(params.id)
    if (!control) {
      return NextResponse.json({ error: 'not_found', message: 'Control not found' }, { status: 404 })
    }

    const beforeValues = {
      control_code: control.control_code,
      title: control.title,
      description: control.description,
    }

    if (body.control_code !== undefined) {
      if (typeof body.control_code !== 'string' || !body.control_code.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'control_code must be a non-empty string.' }, { status: 400 })
      }
      control.control_code = body.control_code.trim()
    }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'title must be a non-empty string.' }, { status: 400 })
      }
      control.title = body.title.trim()
    }
    if (body.description !== undefined) {
      control.description = body.description
    }

    await control.save()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'control.update',
      target_type: 'control',
      target_id: control.id,
      before_values: beforeValues,
      after_values: { control_code: control.control_code, title: control.title, description: control.description },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: control.toJSON() })
  } catch (err) {
    console.error('[CONTROLS] Update error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to update control' }, { status: 500 })
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
    const control = await Control.findByPk(params.id, {
      include: [{ model: ControlVersion, as: 'versions', required: false }],
    })
    if (!control) {
      return NextResponse.json({ error: 'not_found', message: 'Control not found' }, { status: 404 })
    }

    const ctrlJson = control.toJSON() as unknown as Record<string, unknown>
    const versions = (ctrlJson.versions as Record<string, unknown>[] | undefined) || []
    const hasActiveVersion = versions.some((v: Record<string, unknown>) => v.status === 'active')

    if (hasActiveVersion) {
      return NextResponse.json(
        { error: 'conflict', message: 'Cannot delete control with active versions. Deprecate all versions first.' },
        { status: 409 },
      )
    }

    await control.destroy()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'control.delete',
      target_type: 'control',
      target_id: params.id,
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: { id: params.id } })
  } catch (err) {
    console.error('[CONTROLS] Delete error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to delete control' }, { status: 500 })
  }
}
