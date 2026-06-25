import jwt from 'jsonwebtoken'
import { config } from '@/config'

export interface TempTokenPayload {
  sub: string
  purpose: 'totp'
  iat: number
  exp: number
}

export function signTempToken(internalUserId: string): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: TempTokenPayload = {
    sub: internalUserId,
    purpose: 'totp',
    iat: now,
    exp: now + config.jwt.tempJwtExpiryMinutes * 60,
  }
  return jwt.sign(payload, config.jwt.internalAuthSecret)
}

export function verifyTempToken(token: string): TempTokenPayload {
  return jwt.verify(token, config.jwt.internalAuthSecret) as TempTokenPayload
}
