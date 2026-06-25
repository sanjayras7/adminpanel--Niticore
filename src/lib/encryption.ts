import crypto from 'crypto'
import { config } from '@/config'

const ALGORITHM = 'aes-256-gcm'
const TAG_LENGTH = 16
const IV_LENGTH = 12

function deriveKey(): Buffer {
  return crypto.createHash('sha256').update(config.totp.encryptionKey).digest()
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = deriveKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(payload: string): string {
  const parts = payload.split(':')
  if (parts.length < 3) {
    throw new Error('Invalid encrypted payload format')
  }
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts.slice(2).join(':')
  const key = deriveKey()
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
