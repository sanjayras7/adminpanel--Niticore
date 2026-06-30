import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { config } from '@/config'
import { InternalUser, InternalRole } from '@/lib/models'

export interface AuthUser {
  id: string
  name?: string
  surname?: string
  email: string
  internal_role_id: string | null
  roleName?: string | null
}

export const ACTION_PERMISSIONS: Record<string, string[]> = {
  'tenant.resend_invite': ['Super Admin', 'Implementation Manager', 'Customer Success', 'Support'],
  'tenant.reset_onboarding': ['Super Admin', 'Implementation Manager'],
  'tenant.force_verify_domain': ['Super Admin', 'Implementation Manager'],
  'tenant.disable': ['Super Admin'],
  'tenant.unlock_user': ['Super Admin', 'Support'],
  'support.read.tenant_profile': ['Super Admin', 'Implementation Manager', 'Customer Success', 'Support', 'Finance/Admin', 'Engineering', 'Read-only Auditor'],
  'support.read.customer_admins': ['Super Admin', 'Implementation Manager', 'Customer Success', 'Support', 'Engineering', 'Read-only Auditor'],
  'support.read.provisioning_logs': ['Super Admin', 'Implementation Manager', 'Customer Success', 'Support', 'Engineering', 'Read-only Auditor'],
  'support.read.integration_health': ['Super Admin', 'Implementation Manager', 'Customer Success', 'Support', 'Engineering', 'Read-only Auditor'],
  'support.read.usage_errors': ['Super Admin', 'Implementation Manager', 'Customer Success', 'Support', 'Engineering', 'Read-only Auditor'],
  'tenant.framework_config.history': ['Super Admin', 'Implementation Manager', 'Customer Success', 'Support', 'Engineering', 'Read-only Auditor'],
}

export const SENSITIVE_ACTIONS: Set<string> = new Set([
  'tenant.reset_onboarding',
  'tenant.force_verify_domain',
  'tenant.disable',
  'tenant.unlock_user',
])

export class PermissionError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403,
  ) {
    super(message)
    this.name = 'PermissionError'
  }
}

export function requirePermission(authUser: AuthUser, actionKey: string): void {
  const allowedRoles = ACTION_PERMISSIONS[actionKey]
  if (!allowedRoles) {
    throw new PermissionError(`Unknown action: ${actionKey}`, 400)
  }
  if (!authUser.roleName || !allowedRoles.includes(authUser.roleName)) {
    throw new PermissionError(`Role '${authUser.roleName}' is not authorized to perform '${actionKey}'`, 403)
  }
}

export function requireReason(actionKey: string, reason: string | undefined | null): void {
  if (SENSITIVE_ACTIONS.has(actionKey)) {
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new PermissionError('Reason is required for this action', 422)
    }
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

// Backend API authentication - uses x-internal-user-id header
export async function getAuthUser(request: NextRequest): Promise<AuthUser> {
  const userId = request.headers.get('x-internal-user-id')
  if (!userId) {
    throw new AuthError('Authentication required', 401)
  }

  const user = await InternalUser.findByPk(userId, {
    include: [{ model: InternalRole, as: 'role' }],
  })

  if (!user) {
    throw new AuthError('User not found', 401)
  }

  const role = user.get('role') as InternalRole | null

  return {
    id: user.id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    internal_role_id: user.internal_role_id,
    roleName: role?.name ?? null,
  }
}

export async function getAuthUserFromHeaders(
  headers: Headers | Record<string, string>,
): Promise<AuthUser> {
  const userId = 'get' in headers
    ? (headers as Headers).get('x-internal-user-id')
    : (headers as Record<string, string>)['x-internal-user-id']

  if (!userId) {
    throw new AuthError('Authentication required', 401)
  }

  const user = await InternalUser.findByPk(userId, {
    include: [{ model: InternalRole, as: 'role' }],
  })

  if (!user) {
    throw new AuthError('User not found', 401)
  }

  const role = user.get('role') as InternalRole | null

  return {
    id: user.id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    internal_role_id: user.internal_role_id,
    roleName: role?.name ?? null,
  }
}

export function requireMutationAuth(authUser: AuthUser): void {
  if (authUser.roleName === 'Read-only Auditor') {
    throw new AuthError('Read-only Auditor cannot perform mutations', 403)
  }
}

export function requireRoles(authUser: AuthUser, allowedRoles: string[]): void {
  if (!authUser.roleName || !allowedRoles.includes(authUser.roleName)) {
    throw new AuthError(`Required role: ${allowedRoles.join(' or ')}`, 403)
  }
}

// Frontend session authentication - uses JWT Bearer token
export async function authenticateRequest(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)
  if (!token) {
    return null
  }

  try {
    const payload = jwt.verify(token, config.jwt.internalAuthSecret) as {
      sub: string
    }

    const user = await InternalUser.findByPk(payload.sub, {
      attributes: ['id', 'name', 'surname', 'email', 'internal_role_id'],
      include: [{ model: InternalRole, as: 'role', attributes: ['name'] }],
      rejectOnEmpty: false,
    })

    if (!user) {
      return null
    }

    const role = user.get('role') as InternalRole | null

    return {
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      internal_role_id: user.internal_role_id,
      roleName: role?.name ?? null,
    }
  } catch {
    return null
  }
}

export function requireSuperAdmin(authUser: AuthUser): void {
  if (authUser.roleName !== 'Super Admin') {
    throw new AuthError('Only Super Admin can override gates', 403)
  }
}
