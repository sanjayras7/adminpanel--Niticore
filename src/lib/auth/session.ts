import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { InternalSession } from '@/lib/models/InternalSession'
import { InternalUser } from '@/lib/models/InternalUser'
import { InternalRole } from '@/lib/models/InternalRole'
import type { InternalRoleName } from '@/lib/permission-matrix'

export interface InternalSessionUser {
  id: string
  name: string
  surname: string
  email: string
  roleId: string
  roleName: InternalRoleName
  status: 'active' | 'inactive' | 'locked'
  totpEnabled: boolean
  sessionId: string
}

export interface SessionError {
  error: 'unauthorized' | 'forbidden' | 'server_error'
  message: string
  status: number
}

export function isSessionError(
  result: InternalSessionUser | SessionError,
): result is SessionError {
  return 'error' in result
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (/^[0-9a-f]{64}$/i.test(token)) {
      return token
    }
  }

  const cookie = request.cookies.get('internal_session')?.value
  if (cookie && /^[0-9a-f]{64}$/i.test(cookie)) {
    return cookie
  }

  return null
}

export async function getInternalSession(
  request: NextRequest,
): Promise<InternalSessionUser | SessionError> {
  const token = extractToken(request)

  if (!token) {
    return { error: 'unauthorized', message: 'Authentication required', status: 401 }
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  let session: InternalSession | null = null
  try {
    session = await InternalSession.findOne({ where: { token_hash: tokenHash } })
  } catch {
    return { error: 'server_error', message: 'Internal error', status: 500 }
  }

  if (!session) {
    return { error: 'unauthorized', message: 'Session not found or expired', status: 401 }
  }

  const now = new Date()

  if (now >= new Date(session.expires_at)) {
    try { await session.destroy() } catch { /* cleanup failure — still 401 */ }
    return { error: 'unauthorized', message: 'Session expired', status: 401 }
  }

  if (now >= new Date(session.idle_expires_at)) {
    try { await session.destroy() } catch { /* cleanup failure — still 401 */ }
    return { error: 'unauthorized', message: 'Session expired due to inactivity', status: 401 }
  }

  try {
    await InternalSession.update(
      { last_activity_at: now },
      { where: { id: session.id }, fields: ['last_activity_at'] },
    )
  } catch {
    // non-fatal
  }

  let user: InternalUser | null = null
  try {
    user = await InternalUser.findByPk(session.internal_user_id)
  } catch {
    return { error: 'server_error', message: 'Internal error', status: 500 }
  }

  if (!user) {
    return { error: 'unauthorized', message: 'User no longer exists', status: 401 }
  }

  if (user.status !== 'active') {
    return { error: 'unauthorized', message: 'Account inactive or locked', status: 401 }
  }

  if (!user.internal_role_id) {
    return { error: 'forbidden', message: 'No role assigned', status: 403 }
  }

  let role: InternalRole | null = null
  try {
    role = await InternalRole.findByPk(user.internal_role_id)
  } catch {
    return { error: 'server_error', message: 'Internal error', status: 500 }
  }

  if (!role || !role.is_active) {
    return { error: 'forbidden', message: 'No role assigned', status: 403 }
  }

  return {
    id: user.id,
    name: user.name,
    surname: user.surname,
    email: user.email,
    roleId: role.id,
    roleName: role.name as InternalRoleName,
    status: user.status,
    totpEnabled: user.totp_enabled,
    sessionId: session.id,
  }
}
