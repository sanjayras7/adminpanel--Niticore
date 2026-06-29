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

export function requireMutationAuth(authUser: AuthUser): void {
  if (authUser.roleName === 'Read-only Auditor') {
    throw new AuthError('Read-only Auditor cannot perform mutations', 403)
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