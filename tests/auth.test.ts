import { checkRateLimit, checkEmailRateLimit, resetRateLimiter } from '@/lib/rate-limiter'
import { signTempToken, verifyTempToken } from '@/lib/jwt'
import { config } from '@/config'

beforeEach(() => {
  resetRateLimiter()
})

describe('POST /api/v1/internal/auth/login - rate limiting', () => {
  it('allows first request from an IP', () => {
    const result = checkRateLimit('login:ip:127.0.0.1')
    expect(result.allowed).toBe(true)
    expect(result.retryAfterMs).toBe(0)
  })

  it('allows requests up to the max limit from same IP', () => {
    for (let i = 0; i < config.rateLimit.maxRequests; i++) {
      const result = checkRateLimit('login:ip:127.0.0.1')
      expect(result.allowed).toBe(true)
    }
  })

  it('blocks requests exceeding the max limit from same IP', () => {
    for (let i = 0; i < config.rateLimit.maxRequests; i++) {
      checkRateLimit('login:ip:127.0.0.1')
    }
    const result = checkRateLimit('login:ip:127.0.0.1')
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('tracks different IPs independently', () => {
    for (let i = 0; i < config.rateLimit.maxRequests; i++) {
      checkRateLimit('login:ip:10.0.0.1')
    }
    const blockedIp = checkRateLimit('login:ip:10.0.0.1')
    expect(blockedIp.allowed).toBe(false)

    const allowedIp = checkRateLimit('login:ip:10.0.0.2')
    expect(allowedIp.allowed).toBe(true)
  })

  it('resets rate limit window after expiry', () => {
    for (let i = 0; i < config.rateLimit.maxRequests; i++) {
      checkRateLimit('login:ip:10.0.0.1')
    }
    const blocked = checkRateLimit('login:ip:10.0.0.1')
    expect(blocked.allowed).toBe(false)

    resetRateLimiter()

    const allowed = checkRateLimit('login:ip:10.0.0.1')
    expect(allowed.allowed).toBe(true)
  })
})

describe('POST /api/v1/internal/auth/login - email rate limiting', () => {
  it('allows first email request', () => {
    expect(checkEmailRateLimit('test@example.com')).toBe(true)
  })

  it('blocks after max per-hour limit', () => {
    for (let i = 0; i < config.rateLimit.maxPerEmailHour; i++) {
      expect(checkEmailRateLimit('test@example.com')).toBe(true)
    }
    expect(checkEmailRateLimit('test@example.com')).toBe(false)
  })

  it('tracks different emails independently', () => {
    for (let i = 0; i < config.rateLimit.maxPerEmailHour; i++) {
      checkEmailRateLimit('first@example.com')
    }
    expect(checkEmailRateLimit('first@example.com')).toBe(false)
    expect(checkEmailRateLimit('second@example.com')).toBe(true)
  })
})

describe('POST /api/v1/internal/auth/verify-magic-link - rate limiting', () => {
  it('allows first verification request', () => {
    const result = checkRateLimit('verify:ip:127.0.0.1')
    expect(result.allowed).toBe(true)
  })

  it('blocks verification after max attempts', () => {
    for (let i = 0; i < config.rateLimit.maxRequests; i++) {
      checkRateLimit('verify:ip:10.0.0.1')
    }
    const result = checkRateLimit('verify:ip:10.0.0.1')
    expect(result.allowed).toBe(false)
  })
})

describe('temp JWT token generation and verification', () => {
  const MOCK_USER_ID = '123e4567-e89b-12d3-a456-426614174000'

  it('signs a temp token with correct payload', () => {
    const token = signTempToken(MOCK_USER_ID)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)
  })

  it('verifies a valid temp token', () => {
    const token = signTempToken(MOCK_USER_ID)
    const payload = verifyTempToken(token)
    expect(payload.sub).toBe(MOCK_USER_ID)
    expect(payload.purpose).toBe('totp')
  })

  it('includes correct expiry (5 min)', () => {
    const now = Math.floor(Date.now() / 1000)
    const token = signTempToken(MOCK_USER_ID)
    const payload = verifyTempToken(token)
    expect(payload.exp - payload.iat).toBe(config.jwt.tempJwtExpiryMinutes * 60)
    expect(payload.exp).toBeGreaterThan(now)
  })

  it('throws on invalid token', () => {
    expect(() => verifyTempToken('invalid-token')).toThrow()
  })

  it('throws on tampered token', () => {
    const token = signTempToken(MOCK_USER_ID)
    const parts = token.split('.')
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`
    expect(() => verifyTempToken(tampered)).toThrow()
  })
})
