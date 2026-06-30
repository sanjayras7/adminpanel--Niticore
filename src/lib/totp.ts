import crypto from 'crypto'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { config } from '@/config'

export interface GeneratedSecret {
  base32: string
  ascii: string
  otpauth_url: string
}

function deriveEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(config.encryption.internalAuthEncryptionKey, 'utf-8').digest()
}

export function generateTotpSecret(): GeneratedSecret {
  const secret = speakeasy.generateSecret({
    name: `Niticore Admin (${config.email.magicLinkBaseUrl})`,
    length: 20,
  })
  return {
    base32: secret.base32!,
    ascii: secret.ascii!,
    otpauth_url: secret.otpauth_url!,
  }
}

export async function generateQrCodeDataUri(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    type: 'image/png',
    margin: 2,
    width: 300,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

export type VerifyResult = { valid: true } | { valid: false; reason: 'invalid_code' | 'expired' }

export function verifyTotpCode(secret: string, code: string): VerifyResult {
  const isValidWithinWindow = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 1,
  })
  if (isValidWithinWindow) {
    return { valid: true }
  }

  const isValidOutsideWindow = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 4,
  })
  if (isValidOutsideWindow) {
    return { valid: false, reason: 'expired' }
  }

  return { valid: false, reason: 'invalid_code' }
}

export function encryptSecret(plaintext: string): string {
  const key = deriveEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export const TEMP_SECRET_TTL_MS = 30 * 60 * 1000

interface TempSecretEntry {
  secret: GeneratedSecret
  expiresAt: number
}

const tempSecretStore = new Map<string, TempSecretEntry>()

export function storeTempSecret(userId: string, secret: GeneratedSecret): void {
  tempSecretStore.set(userId, {
    secret,
    expiresAt: Date.now() + TEMP_SECRET_TTL_MS,
  })
}

export function retrieveTempSecret(userId: string): GeneratedSecret | null {
  const entry = tempSecretStore.get(userId)
  if (!entry || Date.now() > entry.expiresAt) {
    tempSecretStore.delete(userId)
    return null
  }
  return entry.secret
}

export function deleteTempSecret(userId: string): void {
  tempSecretStore.delete(userId)
}

export function clearTempSecrets(): void {
  tempSecretStore.clear()
}

import { authenticator } from 'otplib'

export interface TOTPValidation {
  valid: boolean
  delta: number | null
}

authenticator.options = { window: config.totp.windowSize }

export function generateSecret(): string {
  return authenticator.generateSecret()
}

export function generateTOTP(secret: string): string {
  return authenticator.generate(secret)
}

export function validateTOTP(token: string, secret: string): TOTPValidation {
  const delta = authenticator.verifyDelta({ token, secret })
  if (delta === null) {
    return { valid: false, delta: null }
  }
  return { valid: true, delta }
}


