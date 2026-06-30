import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { GateOverride } from '@/lib/models'
import { getAuthUser, requireSuperAdmin } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

const VALID_GATE_TYPES = ['nda', 'contract'] as const

export async function POST(request: NextRequest): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireSuperAdmin(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  let body: {
    gate_type?: string
    lead_id?: string
    organization_id?: string
    reason?: string
    metadata?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  try {
    if (!body.gate_type || typeof body.gate_type !== 'string') {
      return NextResponse.json({ error: 'validation_error', message: 'gate_type is required' }, { status: 400 })
    }

    const normalizedGateType = body.gate_type.toLowerCase()
    if (!(VALID_GATE_TYPES as readonly string[]).includes(normalizedGateType)) {
      return NextResponse.json({ error: 'validation_error', message: "gate_type must be 'nda' or 'contract'" }, { status: 400 })
    }

    const hasLeadId = body.lead_id !== undefined && body.lead_id !== null && body.lead_id !== ''
    const hasOrgId = body.organization_id !== undefined && body.organization_id !== null && body.organization_id !== ''

    if (!hasLeadId && !hasOrgId) {
      return NextResponse.json(
        { error: 'validation_error', message: 'Exactly one of lead_id or organization_id is required' },
        { status: 400 },
      )
    }

    if (hasLeadId && hasOrgId) {
      return NextResponse.json(
        { error: 'validation_error', message: 'Provide only one of lead_id or organization_id' },
        { status: 400 },
      )
    }

    if (!body.reason || typeof body.reason !== 'string') {
      return NextResponse.json({ error: 'validation_error', message: 'reason is required' }, { status: 400 })
    }

    const trimmedReason = body.reason.trim()
    if (!trimmedReason) {
      return NextResponse.json({ error: 'validation_error', message: 'reason must not be empty' }, { status: 400 })
    }

    const id = uuidv4()
    const overrideData: Record<string, unknown> = {
      id,
      gate_type: normalizedGateType,
      lead_id: hasLeadId ? body.lead_id : null,
      organization_id: hasOrgId ? body.organization_id : null,
      overridden_by: authUser.id,
      reason: trimmedReason,
      metadata: body.metadata ?? null,
      created_at: new Date(),
    }

    await GateOverride.create(overrideData)

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'gate_override',
      target_type: 'gate_override',
      target_id: id,
      organization_id: hasOrgId ? body.organization_id : null,
      lead_id: hasLeadId ? body.lead_id : null,
      before_values: null,
      after_values: {
        id,
        gate_type: normalizedGateType,
        lead_id: hasLeadId ? body.lead_id : null,
        organization_id: hasOrgId ? body.organization_id : null,
        overridden_by: authUser.id,
        reason: trimmedReason,
        created_at: overrideData.created_at.toISOString(),
      },
      reason: trimmedReason,
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: overrideData }, { status: 201 })
  } catch (err) {
    console.error('[GATES] Override error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to create override' }, { status: 500 })
  }
}
