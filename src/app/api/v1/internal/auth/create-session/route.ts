import { NextRequest, NextResponse } from 'next/server'
import { verifyTempToken } from '@/lib/jwt'
import { InternalUser } from '@/lib/models'
import { createInternalSession } from '@/lib/create-internal-session'
import { config } from '@/config'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { temp_token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (!body.temp_token || typeof body.temp_token !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Temp token is required.' },
      { status: 400 },
    )
  }

  let payload: { sub: string }
  try {
    payload = verifyTempToken(body.temp_token)
  } catch {
    return NextResponse.json(
      { error: 'invalid_token', message: 'Token is invalid or expired.' },
      { status: 401 },
    )
  }

  if (payload.sub === 'undefined' || payload.sub === 'null' || !payload.sub) {
    return NextResponse.json(
      { error: 'invalid_token', message: 'Token is invalid or expired.' },
      { status: 401 },
    )
  }

  let user: InternalUser | null = null
  try {
    user = await InternalUser.findByPk(payload.sub, {
      attributes: ['id', 'status'],
    })
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (!user || user.status !== 'active') {
    return NextResponse.json(
      { error: 'unauthorized', message: 'User not found or inactive.' },
      { status: 401 },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  let session
  try {
    session = await createInternalSession(user.id, ip, userAgent)
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  const maxAgeSeconds = config.session.absoluteExpiryMinutes * 60
  const response = NextResponse.json({
    id: user.id,
    session_id: session.sessionId,
    expires_at: session.expiresAt,
    idle_expires_at: session.idleExpiresAt,
  })

  response.cookies.set('internal_session', session.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/internal',
    maxAge: maxAgeSeconds,
  })

  return response
}
