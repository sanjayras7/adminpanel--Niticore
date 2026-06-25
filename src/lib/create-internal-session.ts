import crypto from 'crypto'
import { InternalSession } from '@/lib/models/InternalSession'
import { config } from '@/config'

export interface CreateInternalSessionOptions {
  absoluteExpiryMinutes?: number
  idleExpiryMinutes?: number
}

export interface CreateInternalSessionResult {
  sessionId: string
  token: string
  expiresAt: string
  idleExpiresAt: string
}

export async function createInternalSession(
  internalUserId: string,
  ipAddress: string,
  userAgent: string,
  options?: CreateInternalSessionOptions,
): Promise<CreateInternalSessionResult> {
  const absoluteExpiryMinutes = options?.absoluteExpiryMinutes ?? config.session.absoluteExpiryMinutes
  const idleExpiryMinutes = options?.idleExpiryMinutes ?? config.session.idleExpiryMinutes

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const now = new Date()
  const expiresAt = new Date(now.getTime() + absoluteExpiryMinutes * 60 * 1000)
  const idleExpiresAt = new Date(now.getTime() + idleExpiryMinutes * 60 * 1000)

  const session = await InternalSession.create({
    internal_user_id: internalUserId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    idle_expires_at: idleExpiresAt,
    created_at: now,
    last_activity_at: now,
    ip_address: ipAddress,
    user_agent: userAgent,
  } as InternalSession)

  return {
    sessionId: session.id,
    token,
    expiresAt: expiresAt.toISOString(),
    idleExpiresAt: idleExpiresAt.toISOString(),
  }
}
