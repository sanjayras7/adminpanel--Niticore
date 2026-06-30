import { NextRequest, NextResponse } from 'next/server'
import { ControlRiskMapping } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
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
    const mapping = await ControlRiskMapping.findByPk(params.id)
    if (!mapping) {
      return NextResponse.json({ error: 'not_found', message: 'Mapping not found' }, { status: 404 })
    }

    return NextResponse.json({ data: mapping.toJSON() })
  } catch (err) {
    console.error('[CONTROL_RISK_MAPPINGS] Get error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to get mapping' }, { status: 500 })
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

  let body: { control_id?: string; risk_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  try {
    const mapping = await ControlRiskMapping.findByPk(params.id)
    if (!mapping) {
      return NextResponse.json({ error: 'not_found', message: 'Mapping not found' }, { status: 404 })
    }

    const beforeValues = {
      control_id: mapping.control_id,
      risk_id: mapping.risk_id,
    }

    if (body.control_id !== undefined) {
      if (typeof body.control_id !== 'string' || !body.control_id.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'control_id must be a non-empty string.' }, { status: 400 })
      }
      mapping.control_id = body.control_id.trim()
    }
    if (body.risk_id !== undefined) {
      if (typeof body.risk_id !== 'string' || !body.risk_id.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'risk_id must be a non-empty string.' }, { status: 400 })
      }
      mapping.risk_id = body.risk_id.trim()
    }

    await mapping.save()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'mapping.update',
      target_type: 'control_risk_mapping',
      target_id: mapping.id,
      before_values: beforeValues,
      after_values: { control_id: mapping.control_id, risk_id: mapping.risk_id },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: mapping.toJSON() })
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
    console.error('[CONTROL_RISK_MAPPINGS] Update error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to update mapping' }, { status: 500 })
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
    const mapping = await ControlRiskMapping.findByPk(params.id)
    if (!mapping) {
      return NextResponse.json({ error: 'not_found', message: 'Mapping not found' }, { status: 404 })
    }

    const beforeValues = {
      control_id: mapping.control_id,
      risk_id: mapping.risk_id,
    }

    await mapping.destroy()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'mapping.delete',
      target_type: 'control_risk_mapping',
      target_id: params.id,
      before_values: beforeValues,
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: { id: params.id } })
  } catch (err) {
    console.error('[CONTROL_RISK_MAPPINGS] Delete error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to delete mapping' }, { status: 500 })
  }
}
