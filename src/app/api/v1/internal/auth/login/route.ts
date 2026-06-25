import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize'
import { InternalUser, MagicLink } from '@/lib/models'
import { sendMagicLinkEmail } from '@/lib/email'
import { checkRateLimit, checkEmailRateLimit } from '@/lib/rate-limiter'
import { config } from '@/config'

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  const ipLimit = checkRateLimit(`login:ip:${ip}`)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } },
    )
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Email is required.' },
      { status: 400 },
    )
  }

  const email = body.email.toLowerCase().trim()

  const emailLimit = checkEmailRateLimit(email)
  if (!emailLimit) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests for this email. Please try again later.' },
      { status: 429 },
    )
  }

  let internalUser: InternalUser | null = null
  try {
    internalUser = await InternalUser.findOne({
      where: { email, deleted_at: null, status: 'active' },
    })
  } catch {
    // DB error - log but continue with generic response
    console.error('[AUTH] Database error during user lookup')
  }

  if (internalUser) {
    const token = uuidv4()
    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + config.jwt.magicLinkExpiryMinutes * 60 * 1000)

    try {
      await MagicLink.create({
        id: uuidv4(),
        token,
        otp,
        email,
        internal_user_id: internalUser.id,
        purpose: 'login',
        consumed_at: null,
        expires_at: expiresAt,
      } as MagicLink)

      await sendMagicLinkEmail(email, token, otp).catch((err) => {
        console.error('[AUTH] Email send failed:', err)
      })
    } catch (err) {
      console.error('[AUTH] Failed to create magic link:', err)
    }
  }

  return NextResponse.json(
    { message: 'If the email exists, a magic link has been sent' },
    { status: 200 },
  )
}
