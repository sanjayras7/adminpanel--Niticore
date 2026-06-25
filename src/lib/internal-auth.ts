import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { InternalSession } from '@/lib/models/InternalSession'
import { sequelize } from '@/lib/sequelize'

export interface InternalAuthData {
  internalUserId: string
  sessionId: string
}

export async function getInternalSession(request: NextRequest): Promise<InternalAuthData | null> {
  const token = request.cookies.get('internal_session')?.value
  if (!token) return null

  if (!/^[0-9a-f]{64}$/i.test(token)) return null

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  let session: InternalSession | null = null
  try {
    session = await InternalSession.findOne({
      where: { token_hash: tokenHash },
    })
  } catch {
    return null
  }

  if (!session) return null

  const now = new Date()

  if (now >= new Date(session.expires_at)) {
    await session.destroy()
    return null
  }

  if (now >= new Date(session.idle_expires_at)) {
    await session.destroy()
    return null
  }

  try {
    await InternalSession.update(
      { last_activity_at: now },
      {
        where: { id: session.id },
        fields: ['last_activity_at'],
      },
    )
  } catch {
    // non-fatal - proceed with stale last_activity_at
  }

  return {
    internalUserId: session.internal_user_id,
    sessionId: session.id,
  }
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'unauthorized', message: 'Session not found or expired' },
    { status: 401 },
  )
}
