import { NextRequest, NextResponse } from 'next/server'
import { sequelize } from '@/lib/sequelize'
import { Organization, TenantStatus, TENANT_STATUSES } from '@/lib/models/Organization'
import { getAuthUser, requirePermission, canChangeTerminalStatus } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
import { canActivateTenant } from '@/lib/gates'

export const TENANT_TRANSITIONS: Record<TenantStatus, TenantStatus[]> = {
  'Draft': ['Pending Setup', 'Archived'],
  'Pending Setup': ['Active', 'Draft', 'Archived'],
  'Active': ['Suspended', 'Churned'],
  'Suspended': ['Active', 'Churned'],
  'Churned': [],
  'Archived': [],
}

function isValidTransition(from: TenantStatus, to: TenantStatus): boolean {
  const allowed = TENANT_TRANSITIONS[from]
  return allowed ? allowed.includes(to) : false
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requirePermission('tenant:change_status', authUser)
  } catch (err: unknown) {
    const statusCode = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    const errorCode = statusCode === 401 ? 'unauthorized' : 'forbidden'
    return NextResponse.json({ error: errorCode, message: err instanceof Error ? err.message : 'Forbidden' }, { status: statusCode })
  }

  let body: { status?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.status || typeof body.status !== 'string' || !body.status.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'Status is required.' }, { status: 400 })
  }

  const targetStatus = body.status.trim() as TenantStatus
  if (!TENANT_STATUSES.includes(targetStatus)) {
    return NextResponse.json(
      { error: 'invalid_request', message: `Invalid status '${body.status}'. Must be one of: ${TENANT_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  const txn = await sequelize.transaction()

  try {
    const organization = await Organization.findByPk(params.id, {
      lock: txn.LOCK.UPDATE,
      transaction: txn,
    })

    if (!organization) {
      await txn.rollback()
      return NextResponse.json({ error: 'not_found', message: 'Organization not found' }, { status: 404 })
    }

    const currentStatus = organization.status as TenantStatus

    if (currentStatus === targetStatus) {
      const changedAt = new Date().toISOString()

      await writeAuditEvent({
        actor_internal_user_id: authUser.id,
        actor_role: authUser.roleName,
        action: 'tenant_status_change',
        target_type: 'organization',
        target_id: organization.id,
        before_values: { status: currentStatus },
        after_values: { status: targetStatus },
        reason: body.reason || null,
        ip_address: ip,
        user_agent: userAgent,
      })

      await txn.commit()
      return NextResponse.json({
        organization_id: organization.id,
        previous_status: currentStatus,
        current_status: targetStatus,
        changed_at: changedAt,
        no_change: true,
      })
    }

    const isChurnedOrArchived = currentStatus === 'Churned' || currentStatus === 'Archived'
    if (isChurnedOrArchived && !canChangeTerminalStatus(authUser)) {
      await txn.rollback()
      return NextResponse.json({
        error: 'forbidden',
        message: 'Only Super Admin can change status from a terminal state.',
      }, { status: 403 })
    }

    if (!isValidTransition(currentStatus, targetStatus)) {
      const allowedFrom = TENANT_TRANSITIONS[currentStatus]
      await txn.rollback()
      return NextResponse.json({
        error: 'invalid_transition',
        message: `Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions from '${currentStatus}': ${allowedFrom.length > 0 ? allowedFrom.join(', ') : '(none)'}`,
      }, { status: 422 })
    }

    if (targetStatus === 'Suspended' || targetStatus === 'Archived') {
      if (!body.reason || typeof body.reason !== 'string' || !body.reason.trim()) {
        await txn.rollback()
        return NextResponse.json({
          error: 'invalid_request',
          message: `Reason is required when transitioning to '${targetStatus}'.`,
        }, { status: 400 })
      }
    }

    if (targetStatus === 'Active') {
      const gateResult = await canActivateTenant(organization.id)
      if (!gateResult.allowed) {
        await txn.rollback()
        return NextResponse.json({
          error: 'activation_blocked',
          message: gateResult.reason || 'Cannot transition to Active: activation gate blocked.',
        }, { status: 403 })
      }
    }

    const previousStatus = organization.status
    organization.status = targetStatus
    await organization.save({ transaction: txn })

    const changedAt = new Date().toISOString()

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'tenant_status_change',
      target_type: 'organization',
      target_id: organization.id,
      before_values: { status: previousStatus },
      after_values: { status: targetStatus },
      reason: body.reason || null,
      ip_address: ip,
      user_agent: userAgent,
    })

    await txn.commit()

    return NextResponse.json({
      organization_id: organization.id,
      previous_status: previousStatus,
      current_status: targetStatus,
      changed_at: changedAt,
    })
  } catch (err) {
    await txn.rollback()
    console.error('[ORGANIZATIONS] Status change error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to change organization status' }, { status: 500 })
  }
}
