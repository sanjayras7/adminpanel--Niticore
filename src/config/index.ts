import dotenv from 'dotenv'

dotenv.config({ path: `.env.${process.env.NODE_ENV || 'local'}` })
dotenv.config({ path: '.env.local' })

export const config = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin',
  },
  jwt: {
    internalAuthSecret: process.env.INTERNAL_AUTH_JWT_SECRET || 'dev-secret-change-in-production',
    magicLinkExpiryMinutes: parseInt(process.env.MAGIC_LINK_EXPIRY_MINUTES || '10', 10),
    tempJwtExpiryMinutes: parseInt(process.env.TEMP_JWT_EXPIRY_MINUTES || '5', 10),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5', 10),
    maxPerEmailHour: 3,
    emailWindowMs: 3600000,
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@niticore.com',
    magicLinkBaseUrl: process.env.MAGIC_LINK_BASE_URL || 'http://localhost:3000/internal/auth/verify',
  },
  totp: {
    encryptionKey: process.env.TOTP_ENCRYPTION_KEY || 'dev-encryption-key-32-bytes-long!',
    windowSize: parseInt(process.env.TOTP_WINDOW_SIZE || '1', 10),
    lockoutDurationMinutes: parseInt(process.env.TOTP_LOCKOUT_DURATION_MINUTES || '15', 10),
    maxFailedAttempts: parseInt(process.env.TOTP_MAX_FAILED_ATTEMPTS || '5', 10),
  },
  session: {
    absoluteExpiryMinutes: parseInt(process.env.SESSION_ABSOLUTE_EXPIRY_MINUTES || '1440', 10),
    idleExpiryMinutes: parseInt(process.env.SESSION_IDLE_EXPIRY_MINUTES || '60', 10),
  },
  isTest: process.env.NODE_ENV === 'test',
}
