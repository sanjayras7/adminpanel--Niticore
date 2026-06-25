import { authenticator } from 'otplib'
import { config } from '@/config'

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


