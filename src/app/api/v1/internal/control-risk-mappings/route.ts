import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { ControlRiskMapping } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const control_id = searchParams.get('control_id') || ''
  const risk_id = searchParams.get('risk_id') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const page_size = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))

  const where: Record<string, unknown> = {}
  if (control_id) where.control_id = control_id
  if (risk_id) where.risk_id = risk_id

  try {
    const { count, rows } = await ControlRiskMapping.findAndCountAll({
      where,
      limit: page_size,
      offset: (page - 1) * page_size,
      order: [['created_at', 'DESC']],
    })

    return NextResponse.json({ data: rows.map((r) => r.toJSON()), total: count, page, page_size })
  } catch (err) {
    console.error('[CONTROL_RISK_MAPPINGS] List error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to list mappings' }, { status: 500 })
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

  let body: { control_id?: string; risk_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.control_id || typeof body.control_id !== 'string' || !body.control_id.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'control_id is required.' }, { status: 400 })
  }
  if (!body.risk_id || typeof body.risk_id !== 'string' || !body.risk_id.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'risk_id is required.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const mapping = await ControlRiskMapping.create({
      id: uuidv4(),
      control_id: body.control_id.trim(),
      risk_id: body.risk_id.trim(),
    } as ControlRiskMapping)

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'mapping.create',
      target_type: 'control_risk_mapping',
      target_id: mapping.id,
      after_values: { control_id: body.control_id.trim(), risk_id: body.risk_id.trim() },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: mapping.toJSON() }, { status: 201 })
  } catch (err: unknown) {
    const errName = (err as Error)?.name || ''
    if (errName === 'SequelizeUniqueConstraintError' || errName === 'UniqueConstraintError') {
      return NextResponse.json(
        { error: 'conflict', message: 'Mapping already exists for this control and risk.' },
        { status: 409 },
      )
    }
    if (errName === 'SequelizeForeignKeyConstraintError' || errName === 'ForeignKeyConstraintError') {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Referenced control or risk does not exist.' },
        { status: 400 },
      )
    }
    console.error('[CONTROL_RISK_MAPPINGS] Create error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to create mapping' }, { status: 500 })
  }
}
