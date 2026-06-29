import { NextRequest, NextResponse } from 'next/server'
import { MagicLink, InternalUser } from '@/lib/models'
import { signTempToken } from '@/lib/jwt'
import { checkRateLimit } from '@/lib/rate-limiter'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  const ipLimit = checkRateLimit(`verify:ip:${ip}`)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } },
    )
  }

  let body: { token?: string; otp?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  const credential = body.token || body.otp
  if (!credential || typeof credential !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Token or OTP is required.' },
      { status: 400 },
    )
  }

  let magicLink: MagicLink | null = null
  try {
    magicLink = await MagicLink.findOne({
      where: {
        ...(body.token ? { token: credential } : { otp: credential }),
        purpose: 'login',
      },
    })
  } catch (err) {
    console.error('[AUTH] Database error during magic link lookup:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (!magicLink) {
    return NextResponse.json(
      { error: 'magic_link_invalid', message: 'This link is invalid or has already been used.' },
      { status: 400 },
    )
  }

  if (magicLink.consumed_at) {
    return NextResponse.json(
      { error: 'magic_link_invalid', message: 'This link is invalid or has already been used.' },
      { status: 400 },
    )
  }

  if (new Date() > magicLink.expires_at) {
    return NextResponse.json(
      { error: 'magic_link_expired', message: 'This link has expired. Please request a new one.' },
      { status: 410 },
    )
  }

  if (!magicLink.internal_user_id) {
    return NextResponse.json(
      { error: 'magic_link_invalid', message: 'This link is invalid or has already been used.' },
      { status: 400 },
    )
  }

  let internalUser = null
  try {
    internalUser = await InternalUser.findByPk(magicLink.internal_user_id, {
      attributes: ['id', 'status', 'totp_enabled', 'totp_enrolled_at'],
    })
  } catch (err) {
    console.error('[AUTH] Database error during user lookup:', err)
  }

  if (!internalUser || internalUser.status !== 'active') {
    return NextResponse.json(
      { error: 'magic_link_invalid', message: 'This link is invalid or has already been used.' },
      { status: 400 },
    )
  }

  try {
    magicLink.consumed_at = new Date()
    await magicLink.save()
  } catch (err) {
    console.error('[AUTH] Failed to consume magic link:', err)
  }

  const tempToken = signTempToken(internalUser.id)

  if (internalUser.totp_enabled) {
    return NextResponse.json({
      totp_required: true,
      totp_enrollment_required: false,
      temp_token: tempToken,
    })
  }

  return NextResponse.json({
    totp_required: false,
    totp_enrollment_required: true,
    temp_token: tempToken,
  })
}
