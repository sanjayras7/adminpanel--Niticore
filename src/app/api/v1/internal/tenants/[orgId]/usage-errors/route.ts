import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { getAuthUser, requirePermission } from '@/lib/auth'
import { Organization, InternalAuditEvent } from '@/lib/models'

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requirePermission(authUser, 'support.read.usage_errors')
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  const { orgId } = params

  try {
    const org = await Organization.findByPk(orgId)
    if (!org) {
      return NextResponse.json({ error: 'not_found', message: 'Tenant not found' }, { status: 404 })
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const recentErrors = await InternalAuditEvent.findAll({
      where: {
        organization_id: orgId,
        created_at: { [Op.gte]: thirtyDaysAgo },
        action: { [Op.like]: '%error%' },
      },
      order: [['created_at', 'DESC']],
      limit: 50,
    })

    const errorMap = new Map<string, { error_type: string; message: string; occurred_at: string; count: number }>()
    for (const event of recentErrors) {
      const key = event.action
      const existing = errorMap.get(key)
      if (existing) {
        existing.count += 1
      } else {
        errorMap.set(key, {
          error_type: event.action,
          message: (event.after_values as Record<string, unknown> | null)?.error_message as string || event.action,
          occurred_at: event.created_at.toISOString(),
          count: 1,
        })
      }
    }

    const lastError = recentErrors.length > 0 ? recentErrors[0].created_at.toISOString() : null

    return NextResponse.json({
      total_users: 0,
      active_users_30d: 0,
      api_calls_30d: 0,
      storage_used_bytes: null,
      recent_errors: Array.from(errorMap.values()),
      error_count_total_30d: recentErrors.length,
      last_error_at: lastError,
    })
  } catch (err) {
    console.error('[USAGE_ERRORS] Error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to load usage and error data' }, { status: 500 })
  }
}
