import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { config } from '@/config'
import { InternalUser } from '@/lib/models'

export interface AuthUser {
  id: string
  email: string
  internal_role_id: string | null
}

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
      attributes: ['id', 'email', 'internal_role_id'],
      rejectOnEmpty: false,
    })

    if (!user) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      internal_role_id: user.internal_role_id,
    }
  } catch {
    return null
  }
}
