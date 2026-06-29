import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { sequelize } from '@/lib/sequelize'
import { InternalUser, InternalRole, InternalAuditEvent } from '@/lib/models'
import { requirePermission } from '@/lib/auth/requirePermission'
import type { InternalSessionUser } from '@/lib/auth/session'

interface RoleChangeBody {
  roleId?: string
  reason?: string
}

interface RoleChangeResponse {
  id: string
  name: string
  surname: string
  email: string
  internal_role_id: string
  internal_role: {
    id: string
    name: string
    description: string | null
  }
  status: string
}

async function handler(
  request: NextRequest,
  { internalUser }: { internalUser: InternalSessionUser },
): Promise<NextResponse<RoleChangeResponse | { error: string; message: string }>> {
  let body: RoleChangeBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  const { roleId, reason } = body

  if (!roleId || typeof roleId !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'roleId is required and must be a string.' },
      { status: 400 },
    )
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'reason is required and must be a non-empty string.' },
      { status: 400 },
    )
  }

  const userId = request.nextUrl.pathname.split('/').slice(-2, -1)[0]
  if (!userId) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'User ID is required.' },
      { status: 400 },
    )
  }

  if (userId === internalUser.id) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Cannot change your own role. Contact another Super Admin.' },
      { status: 409 },
    )
  }

  let targetUser: InternalUser | null = null
  try {
    targetUser = await InternalUser.findByPk(userId)
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (!targetUser || targetUser.deleted_at) {
    return NextResponse.json(
      { error: 'not_found', message: 'User not found' },
      { status: 404 },
    )
  }

  let targetRole: InternalRole | null = null
  try {
    targetRole = await InternalRole.findByPk(roleId)
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (!targetRole || !targetRole.is_active) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid role' },
      { status: 400 },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = request.headers.get('user-agent') || null

  let beforeRoleName: string | null = null
  if (targetUser.internal_role_id) {
    try {
      const beforeRole = await InternalRole.findByPk(targetUser.internal_role_id)
      if (beforeRole) {
        beforeRoleName = beforeRole.name
      }
    } catch {
      return NextResponse.json(
        { error: 'server_error', message: 'An internal error occurred.' },
        { status: 500 },
      )
    }
  }

  const beforeRoleId = targetUser.internal_role_id

  try {
    await sequelize.transaction(async (t) => {
      targetUser.internal_role_id = roleId
      await targetUser.save({ transaction: t })

      await InternalAuditEvent.create(
        {
          id: uuidv4(),
          actor_internal_user_id: internalUser.id,
          actor_role: internalUser.roleName,
          action: 'internal_user.role.change',
          target_type: 'internal_user',
          target_id: targetUser.id,
          organization_id: null,
          lead_id: null,
          before_values: {
            role_id: beforeRoleId,
            role_name: beforeRoleName,
          },
          after_values: {
            role_id: roleId,
            role_name: targetRole.name,
          },
          reason: reason.trim(),
          metadata: {},
          ip_address: ip,
          user_agent: userAgent,
          created_at: new Date(),
        },
        { transaction: t },
      )
    })
  } catch (err) {
    console.error('[ROLE_CHANGE] Transaction failed:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to update role. Please retry.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    id: targetUser.id,
    name: targetUser.name,
    surname: targetUser.surname,
    email: targetUser.email,
    internal_role_id: roleId,
    internal_role: {
      id: targetRole.id,
      name: targetRole.name,
      description: targetRole.description,
    },
    status: targetUser.status,
  })
}

export const PATCH = requirePermission('rbac', 'update')(handler)
