import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize'
import { Control, ControlVersion } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const page_size = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))

  const where: Record<string, unknown> = {}
  if (search) {
    where[Op.or as unknown as string] = [
      { control_code: { [Op.iLike]: `%${search}%` } },
      { title: { [Op.iLike]: `%${search}%` } },
    ]
  }

  try {
    const { count, rows } = await Control.findAndCountAll({
      where,
      include: [{ model: ControlVersion, as: 'versions', required: false }],
      limit: page_size,
      offset: (page - 1) * page_size,
      order: [['created_at', 'DESC']],
    })

    const data = rows.map((ctrl) => {
      const ctrlJson = ctrl.toJSON() as unknown as Record<string, unknown>
      return {
        ...ctrlJson,
        version_count: (ctrlJson.versions as Record<string, unknown>[] | undefined)?.length || 0,
        versions: undefined,
      }
    })

    return NextResponse.json({ data, total: count, page, page_size })
  } catch (err) {
    console.error('[CONTROLS] List error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to list controls' }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  if (!body.control_code || typeof body.control_code !== 'string' || !body.control_code.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'control_code is required.' }, { status: 400 })
  }
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'title is required.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const existing = await Control.findOne({ where: { control_code: body.control_code.trim() }, paranoid: false })
    if (existing) {
      return NextResponse.json(
        { error: 'conflict', message: 'A control with this code already exists.' },
        { status: 409 },
      )
    }

    const control = await Control.create({
      id: uuidv4(),
      control_code: body.control_code.trim(),
      title: body.title.trim(),
      description: body.description || null,
    } as Control)

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'control.create',
      target_type: 'control',
      target_id: control.id,
      after_values: { control_code: body.control_code.trim(), title: body.title.trim(), description: body.description || null },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: control.toJSON() }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json(
        { error: 'conflict', message: 'A control with this code already exists.' },
        { status: 409 },
      )
    }
    console.error('[CONTROLS] Create error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to create control' }, { status: 500 })
  }
}
