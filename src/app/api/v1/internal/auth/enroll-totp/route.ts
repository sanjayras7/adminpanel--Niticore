import { NextRequest, NextResponse } from 'next/server'
import { InternalUser, InternalAuditEvent } from '@/lib/models'
import { verifyTempToken } from '@/lib/jwt'
import { checkRateLimit } from '@/lib/rate-limiter'
import { v4 as uuidv4 } from 'uuid'
import {
  generateTotpSecret,
  generateQrCodeDataUri,
  verifyTotpCode,
  encryptSecret,
  storeTempSecret,
  retrieveTempSecret,
  deleteTempSecret,
} from '@/lib/totp'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  const ipLimit = checkRateLimit(`enroll-totp:ip:${ip}`)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(ipLimit.retryAfterMs / 1000)) } },
    )
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Missing or invalid authorization header.' },
      { status: 401 },
    )
  }

  const tempToken = authHeader.slice(7).trim()
  let payload: { sub: string }
  try {
    payload = verifyTempToken(tempToken)
  } catch {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid or expired token.' },
      { status: 401 },
    )
  }

  if ((payload as any).purpose !== 'totp') {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid token purpose.' },
      { status: 401 },
    )
  }

  const userId = payload.sub

  let body: { confirmation_code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  let internalUser: InternalUser | null = null
  try {
    internalUser = await InternalUser.findByPk(userId)
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (!internalUser || internalUser.status !== 'active') {
    return NextResponse.json(
      { error: 'unauthorized', message: 'User not found or inactive.' },
      { status: 401 },
    )
  }

  if (internalUser.totp_enabled) {
    return NextResponse.json(
      { error: 'already_enrolled', message: 'TOTP is already enabled for this account.' },
      { status: 409 },
    )
  }

  if (body.confirmation_code !== undefined) {
    return handleConfirmation(request, userId, internalUser, body.confirmation_code)
  }

  return handleGeneration(userId)
}

async function handleGeneration(userId: string): Promise<NextResponse> {
  const secret = generateTotpSecret()

  storeTempSecret(userId, secret)

  let qrCode: string
  try {
    qrCode = await generateQrCodeDataUri(secret.otpauth_url)
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to generate QR code.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    qr_code: qrCode,
    manual_key: secret.base32,
  })
}

async function handleConfirmation(
  request: NextRequest,
  userId: string,
  internalUser: InternalUser,
  confirmationCode: string,
): Promise<NextResponse> {
  if (typeof confirmationCode !== 'string' || confirmationCode.length === 0) {
    return NextResponse.json(
      { success: false, error: 'invalid_request' },
      { status: 400 },
    )
  }

  const tempSecret = retrieveTempSecret(userId)
  if (!tempSecret) {
    return NextResponse.json(
      { success: false, error: 'invalid_request' },
      { status: 400 },
    )
  }

  const secretBase32 = tempSecret.base32

  const verifyResult = verifyTotpCode(secretBase32, confirmationCode)
  if (!verifyResult.valid) {
    return NextResponse.json(
      { success: false, error: verifyResult.reason },
      { status: 400 },
    )
  }

  let encryptedSecret: string
  try {
    encryptedSecret = encryptSecret(secretBase32)
  } catch (err) {
    console.error('[TOTP] Encryption failed:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  try {
    internalUser.totp_secret_encrypted = encryptedSecret
    internalUser.totp_enabled = true
    internalUser.totp_enrolled_at = new Date()
    await internalUser.save()
  } catch (err) {
    console.error('[TOTP] Failed to save enrollment:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  deleteTempSecret(userId)

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || null

  try {
    await InternalAuditEvent.create({
      id: uuidv4(),
      actor_internal_user_id: userId,
      actor_role: null,
      action: 'totp_enrolled',
      target_type: 'internal_user',
      target_id: userId,
      organization_id: null,
      lead_id: null,
      before_values: { totp_enabled: false },
      after_values: { totp_enabled: true },
      reason: null,
      metadata: null,
      ip_address: ip,
      user_agent: userAgent,
      created_at: new Date(),
    } as InternalAuditEvent)
  } catch (err) {
    console.error('[TOTP] Audit logging failed:', err)
  }

  return NextResponse.json({
    success: true,
    message: 'TOTP enrollment successful',
  })
}
