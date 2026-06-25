import { NextRequest, NextResponse } from 'next/server'
import { InternalUser } from '@/lib/models'
import { verifyTempToken } from '@/lib/jwt'
import { validateTOTP } from '@/lib/totp'
import { decrypt } from '@/lib/encryption'
import { createInternalSession } from '@/lib/create-internal-session'
import { checkRateLimit } from '@/lib/rate-limiter'
import { config } from '@/config'

const STEP_SECONDS = 30

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  const ipLimit = checkRateLimit(`verify-totp:ip:${ip}`)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } },
    )
  }

  let body: { code?: string; token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (!body.code || typeof body.code !== 'string' || body.code.length !== 6) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'A valid 6-digit TOTP code is required.' },
      { status: 400 },
    )
  }

  if (!body.token || typeof body.token !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Temporary token is required.' },
      { status: 400 },
    )
  }

  let userId: string
  try {
    const payload = verifyTempToken(body.token)
    userId = payload.sub
  } catch {
    return NextResponse.json(
      { error: 'token_invalid', message: 'The temporary token is invalid or has expired.' },
      { status: 401 },
    )
  }

  let user: InternalUser | null = null
  try {
    user = await InternalUser.findByPk(userId)
  } catch (err) {
    console.error('[AUTH] Database error during user lookup:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (!user || user.status !== 'active') {
    return NextResponse.json(
      { error: 'user_inactive', message: 'User account is not active.' },
      { status: 403 },
    )
  }

  if (!user.totp_enabled || !user.totp_secret_encrypted) {
    return NextResponse.json(
      { error: 'totp_not_enrolled', message: 'TOTP is not enrolled for this account.' },
      { status: 403 },
    )
  }

  const now = new Date()

  if (user.locked_until && now < user.locked_until) {
    const retryAfterSec = Math.ceil((user.locked_until.getTime() - now.getTime()) / 1000)
    return NextResponse.json(
      { error: 'account_locked', message: 'Too many failed attempts. Try again later.', retry_after: retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  if (user.locked_until && now >= user.locked_until) {
    user.locked_until = null
  }

  let secret: string
  try {
    secret = decrypt(user.totp_secret_encrypted)
  } catch (err) {
    console.error('[AUTH] Failed to decrypt TOTP secret:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  const result = validateTOTP(body.code, secret)

  if (!result.valid || result.delta === null) {
    const newCount = user.failed_totp_attempt_count + 1
    user.failed_totp_attempt_count = newCount

    if (newCount >= config.totp.maxFailedAttempts) {
      user.locked_until = new Date(now.getTime() + config.totp.lockoutDurationMinutes * 60000)
    }

    try {
      await user.save()
    } catch (err) {
      console.error('[AUTH] Failed to save user state after invalid TOTP:', err)
    }

    if (user.locked_until) {
      const retryAfterSec = Math.ceil(config.totp.lockoutDurationMinutes * 60)
      return NextResponse.json(
        { error: 'account_locked', message: 'Too many failed attempts. Try again later.', retry_after: retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      )
    }

    const attemptsRemaining = config.totp.maxFailedAttempts - newCount
    return NextResponse.json(
      { error: 'invalid_code', message: 'Invalid TOTP code.', attempts_remaining: attemptsRemaining },
      { status: 401 },
    )
  }

  const codeTimestamp = Math.floor(Date.now() / 1000) + result.delta * STEP_SECONDS

  if (user.last_totp_verified_at) {
    const lastVerified = Math.floor(user.last_totp_verified_at.getTime() / 1000)
    if (codeTimestamp <= lastVerified) {
      const newCount = user.failed_totp_attempt_count + 1
      user.failed_totp_attempt_count = newCount

      if (newCount >= config.totp.maxFailedAttempts) {
        user.locked_until = new Date(now.getTime() + config.totp.lockoutDurationMinutes * 60000)
      }

      try {
        await user.save()
      } catch (err) {
        console.error('[AUTH] Failed to save user state after replay attempt:', err)
      }

      if (user.locked_until) {
        const retryAfterSec = Math.ceil(config.totp.lockoutDurationMinutes * 60)
        return NextResponse.json(
          { error: 'account_locked', message: 'Too many failed attempts. Try again later.', retry_after: retryAfterSec },
          { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
        )
      }

      const attemptsRemaining = config.totp.maxFailedAttempts - newCount
      return NextResponse.json(
        { error: 'invalid_code', message: 'Invalid TOTP code.', attempts_remaining: attemptsRemaining },
        { status: 401 },
      )
    }
  }

  user.failed_totp_attempt_count = 0
  user.last_totp_verified_at = now
  user.locked_until = null

  try {
    await user.save()
  } catch (err) {
    console.error('[AUTH] Failed to save user state after successful TOTP:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  const userAgent = request.headers.get('user-agent') || 'unknown'

  let session
  try {
    session = await createInternalSession(user.id, ip, userAgent)
  } catch (err) {
    console.error('[AUTH] Failed to create session:', err)
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
