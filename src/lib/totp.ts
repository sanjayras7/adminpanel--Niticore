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

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
