import { NextRequest } from 'next/server'
import { resetRateLimiter } from '@/lib/rate-limiter'

jest.mock('@/lib/models', () => ({
  InternalUser: { findOne: jest.fn(), findByPk: jest.fn() },
  MagicLink: { findOne: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'mock-link' }) },
}))

jest.mock('@/lib/email', () => ({
  sendMagicLinkEmail: jest.fn().mockResolvedValue(undefined),
}))

import { InternalUser, MagicLink } from '@/lib/models'
import { sendMagicLinkEmail } from '@/lib/email'
import { POST as LoginPost } from '@/app/api/v1/internal/auth/login/route'
import { POST as VerifyPost } from '@/app/api/v1/internal/auth/verify-magic-link/route'

const MOCK_USER_ID = '123e4567-e89b-12d3-a456-426614174000'
const MOCK_EMAIL = 'admin@niticore.com'

function req(body: unknown, ip = '127.0.0.1'): NextRequest {
  return { json: async () => body, headers: new Headers({ 'x-forwarded-for': ip }) } as NextRequest
}

function user(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: MOCK_USER_ID, name: 'Admin', surname: 'User', email: MOCK_EMAIL, status: 'active', totp_enabled: false, totp_enrolled_at: null, ...overrides }
}

function link(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'link-1', token: 'valid-token', otp: '654321', email: MOCK_EMAIL,
    internal_user_id: MOCK_USER_ID, purpose: 'login', consumed_at: null,
    expires_at: new Date(Date.now() + 600000),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  resetRateLimiter()
  ;(InternalUser.findOne as jest.Mock).mockClear()
  ;(InternalUser.findByPk as jest.Mock).mockClear()
  ;(MagicLink.findOne as jest.Mock).mockClear()
  ;(MagicLink.create as jest.Mock).mockClear()
  ;(sendMagicLinkEmail as jest.Mock).mockClear()
})

describe('POST /api/v1/internal/auth/login', () => {
  describe('input validation', () => {
    it('rejects missing email', async () => {
      const res = await LoginPost(req({}))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_request')
    })

    it('rejects non-string email', async () => {
      const res = await LoginPost(req({ email: 12345 }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_request')
    })

    it('rejects invalid JSON body', async () => {
      const bad = { json: async () => { throw new Error('parse error') }, headers: new Headers() } as unknown as NextRequest
      const res = await LoginPost(bad)
      expect(res.status).toBe(400)
    })
  })

  describe('known email flow', () => {
    it('creates magic link and sends email for known active user', async () => {
      (InternalUser.findOne as jest.Mock).mockResolvedValue(user())

      const res = await LoginPost(req({ email: MOCK_EMAIL }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('If the email exists, a magic link has been sent')
      expect(MagicLink.create).toHaveBeenCalledWith(expect.objectContaining({
        email: MOCK_EMAIL,
        internal_user_id: MOCK_USER_ID,
        purpose: 'login',
      }))
      expect(sendMagicLinkEmail).toHaveBeenCalledWith(MOCK_EMAIL, expect.any(String), expect.any(String))
    })
  })

  describe('unknown email flow', () => {
    it('returns generic message without creating link for unknown email', async () => {
      (InternalUser.findOne as jest.Mock).mockResolvedValue(null)

      const res = await LoginPost(req({ email: 'unknown@example.com' }))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.message).toBe('If the email exists, a magic link has been sent')
      expect(MagicLink.create).not.toHaveBeenCalled()
      expect(sendMagicLinkEmail).not.toHaveBeenCalled()
    })
  })

  describe('generic response (no user existence leak)', () => {
    it('returns the same message for known and unknown emails', async () => {
      (InternalUser.findOne as jest.Mock).mockResolvedValue(user())
      const knownRes = await LoginPost(req({ email: MOCK_EMAIL }))
      const knownBody = await knownRes.json()

      ;(InternalUser.findOne as jest.Mock).mockResolvedValue(null)
      const unknownRes = await LoginPost(req({ email: 'unknown@example.com' }))
      const unknownBody = await unknownRes.json()

      expect(knownBody.message).toBe(unknownBody.message)
    })
  })
})

describe('POST /api/v1/internal/auth/verify-magic-link', () => {
  describe('input validation', () => {
    it('rejects missing token and otp', async () => {
      const res = await VerifyPost(req({}))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_request')
    })

    it('rejects non-string token', async () => {
      const res = await VerifyPost(req({ token: 123 }))
      expect(res.status).toBe(400)
    })
  })

  describe('valid token verification', () => {
    it('returns totp_enrollment_required for user without TOTP', async () => {
      (MagicLink.findOne as jest.Mock).mockResolvedValue(link())
      ;(InternalUser.findByPk as jest.Mock).mockResolvedValue(user({ totp_enabled: false }))

      const res = await VerifyPost(req({ token: 'valid-token' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.totp_required).toBe(false)
      expect(body.totp_enrollment_required).toBe(true)
      expect(typeof body.temp_token).toBe('string')
      expect(body.temp_token.split('.')).toHaveLength(3)
    })

    it('returns totp_required for user with TOTP enabled', async () => {
      (MagicLink.findOne as jest.Mock).mockResolvedValue(link())
      ;(InternalUser.findByPk as jest.Mock).mockResolvedValue(user({ totp_enabled: true, totp_enrolled_at: new Date() }))

      const res = await VerifyPost(req({ token: 'valid-token' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.totp_required).toBe(true)
      expect(body.totp_enrollment_required).toBe(false)
      expect(typeof body.temp_token).toBe('string')
    })
  })

  describe('OTP verification', () => {
    it('verifies with OTP instead of token', async () => {
      (MagicLink.findOne as jest.Mock).mockResolvedValue(link({ otp: '123456' }))
      ;(InternalUser.findByPk as jest.Mock).mockResolvedValue(user())

      const res = await VerifyPost(req({ otp: '123456' }))
      expect(res.status).toBe(200)
    })
  })

  describe('edge cases', () => {
    it('returns 410 for expired magic link', async () => {
      (MagicLink.findOne as jest.Mock).mockResolvedValue(link({ expires_at: new Date(Date.now() - 60000) }))

      const res = await VerifyPost(req({ token: 'expired-token' }))
      expect(res.status).toBe(410)
      const body = await res.json()
      expect(body.error).toBe('magic_link_expired')
    })

    it('returns 400 for already consumed link', async () => {
      (MagicLink.findOne as jest.Mock).mockResolvedValue(link({ consumed_at: new Date() }))

      const res = await VerifyPost(req({ token: 'used-token' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('magic_link_invalid')
    })

    it('returns 400 for non-existent token', async () => {
      (MagicLink.findOne as jest.Mock).mockResolvedValue(null)

      const res = await VerifyPost(req({ token: 'nonexistent' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('magic_link_invalid')
    })

    it('returns 400 when link has no internal_user_id', async () => {
      (MagicLink.findOne as jest.Mock).mockResolvedValue(link({ internal_user_id: null }))

      const res = await VerifyPost(req({ token: 'no-user-link' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('magic_link_invalid')
    })

    it('returns 400 when internal user is deactivated', async () => {
      (MagicLink.findOne as jest.Mock).mockResolvedValue(link())
      ;(InternalUser.findByPk as jest.Mock).mockResolvedValue(null)

      const res = await VerifyPost(req({ token: 'valid-token' }))
      expect(res.status).toBe(400)
    })
  })
})
