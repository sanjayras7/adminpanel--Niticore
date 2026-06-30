import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Control, ControlVersion } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

async function getControlOr404(id: string) {
  const control = await Control.findByPk(id)
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

    const versions = await ControlVersion.findAll({
      where: { control_id: params.id },
      order: [['created_at', 'DESC']],
    })

    const data = versions.map((v) => ({
      id: v.id,
      control_id: v.control_id,
      version_label: v.version_label,
      description: v.description,
      status: v.status,
      effective_date: v.effective_date,
      created_at: v.created_at,
      updated_at: v.updated_at,
    }))

    return NextResponse.json({ data, total: data.length })
  } catch (err) {
    console.error('[CONTROL VERSIONS] List error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to list versions' }, { status: 500 })
  }
}

export async function POST(
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

  let body: { version_label?: string; description?: string; effective_date?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.version_label || typeof body.version_label !== 'string' || !body.version_label.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'version_label is required.' }, { status: 400 })
  }

  try {
    const control = await getControlOr404(params.id)
    if (!control) {
      return NextResponse.json({ error: 'not_found', message: 'Control not found' }, { status: 404 })
    }

    const existing = await ControlVersion.findOne({
      where: { control_id: params.id, version_label: body.version_label.trim() },
      paranoid: false,
    })
    if (existing) {
      return NextResponse.json(
        { error: 'conflict', message: 'A version with this label already exists for this control.' },
        { status: 409 },
      )
    }

    const version = await ControlVersion.create({
      id: uuidv4(),
      control_id: params.id,
      version_label: body.version_label.trim(),
      description: body.description || null,
      effective_date: body.effective_date || null,
      status: 'draft',
    } as ControlVersion)

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'control_version.create',
      target_type: 'control_version',
      target_id: version.id,
      after_values: { control_id: params.id, version_label: body.version_label.trim(), description: body.description || null },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: version.toJSON() }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json(
        { error: 'conflict', message: 'A version with this label already exists for this control.' },
        { status: 409 },
      )
    }
    console.error('[CONTROL VERSIONS] Create error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to create version' }, { status: 500 })
  }
}
