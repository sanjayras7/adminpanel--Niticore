import { checkRateLimit, checkEmailRateLimit, resetRateLimiter } from '@/lib/rate-limiter'
import { signTempToken, verifyTempToken } from '@/lib/jwt'
import { config } from '@/config'
import { encrypt, decrypt } from '@/lib/encryption'
import { constantTimeCompare } from '@/lib/totp'

jest.mock('otplib', () => {
  let counter = 1000
  return {
    authenticator: {
      generate: jest.fn((secret: string) => {
        if (secret === 'MOCKBASETOKEN1000') return '123456'
        return '654321'
      }),
      generateSecret: jest.fn(() => {
        counter += 1
        return `MOCKBASETOKEN${counter}`
      }),
      verifyDelta: jest.fn(({ token, secret }: { token: string; secret: string }) => {
        if (token === '123456' && secret === 'MOCKBASETOKEN1000') return 0
        if (token === '654321' && secret.startsWith('MOCKBASETOKEN')) return 0
        return null
      }),
      options: {},
    },
  }
})

import { generateSecret, generateTOTP, validateTOTP } from '@/lib/totp'

const MOCK_USER_ID = '123e4567-e89b-12d3-a456-426614174000'

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
    expect(checkRateLimit('login:ip:10.0.0.1').allowed).toBe(false)
    expect(checkRateLimit('login:ip:10.0.0.2').allowed).toBe(true)
  })
})

describe('email rate limiting', () => {
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

describe('POST /api/v1/internal/auth/verify-magic-link - temp JWT token', () => {
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

describe('TOTP utilities', () => {
  describe('secret generation', () => {
    it('generates a secret string', () => {
      const secret = generateSecret()
      expect(typeof secret).toBe('string')
      expect(secret.length).toBeGreaterThan(0)
    })

    it('generates unique secrets on each call', () => {
      const secret1 = generateSecret()
      const secret2 = generateSecret()
      expect(secret1).not.toBe(secret2)
    })
  })

  describe('code generation and validation', () => {
    it('validates a correctly generated code', () => {
      const secret = generateSecret()
      const code = generateTOTP(secret)
      const result = validateTOTP(code, secret)
      expect(result.valid).toBe(true)
      expect(result.delta).toBe(0)
    })

    it('rejects an invalid code', () => {
      const result = validateTOTP('000000', 'somesecret')
      expect(result.valid).toBe(false)
      expect(result.delta).toBeNull()
    })

    it('rejects a code for a different secret', () => {
      const secret1 = generateSecret()
      const code = generateTOTP(secret1)
      const result = validateTOTP(code, 'othersecret')
      expect(result.valid).toBe(false)
      expect(result.delta).toBeNull()
    })
  })

  describe('constant-time comparison', () => {
    it('returns true for equal strings', () => {
      expect(constantTimeCompare('hello', 'hello')).toBe(true)
    })

    it('returns false for different strings', () => {
      expect(constantTimeCompare('hello', 'world')).toBe(false)
    })

    it('returns false for different length strings', () => {
      expect(constantTimeCompare('abc', 'abcd')).toBe(false)
    })

    it('returns false for empty vs non-empty', () => {
      expect(constantTimeCompare('', 'a')).toBe(false)
    })

    it('returns true for empty strings', () => {
      expect(constantTimeCompare('', '')).toBe(true)
    })
  })
})

describe('TOTP encryption', () => {
  const testSecret = 'JBSWY3DPEB3W64TMMQXC4LQ'

  it('encrypts and decrypts a secret', () => {
    const encrypted = encrypt(testSecret)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(testSecret)
  })

  it('produces different ciphertexts for the same plaintext', () => {
    const encrypted1 = encrypt(testSecret)
    const encrypted2 = encrypt(testSecret)
    expect(encrypted1).not.toBe(encrypted2)
  })

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt(testSecret)
    const parts = encrypted.split(':')
    const tampered = parts.slice(0, 2).join(':') + ':deadbeef'
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws on malformed payload', () => {
    expect(() => decrypt('not-enough-parts')).toThrow('Invalid encrypted payload format')
  })

  it('empty string roundtrips correctly', () => {
    const encrypted = encrypt('')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe('')
  })
})

describe('POST /api/v1/internal/auth/verify-totp - rate limiting', () => {
  it('allows first verify-totp request from an IP', () => {
    const result = checkRateLimit('verify-totp:ip:127.0.0.1')
    expect(result.allowed).toBe(true)
  })

  it('blocks verify-totp after max attempts from same IP', () => {
    for (let i = 0; i < config.rateLimit.maxRequests; i++) {
      checkRateLimit('verify-totp:ip:10.0.0.1')
    }
    const result = checkRateLimit('verify-totp:ip:10.0.0.1')
    expect(result.allowed).toBe(false)
  })

  it('tracks different IPs independently for verify-totp', () => {
    for (let i = 0; i < config.rateLimit.maxRequests; i++) {
      checkRateLimit('verify-totp:ip:10.0.0.1')
    }
    expect(checkRateLimit('verify-totp:ip:10.0.0.1').allowed).toBe(false)
    expect(checkRateLimit('verify-totp:ip:10.0.0.2').allowed).toBe(true)
  })
})
