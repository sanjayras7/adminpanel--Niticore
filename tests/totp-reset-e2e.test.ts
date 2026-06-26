import { NextRequest } from 'next/server'
import { resetRateLimiter } from '@/lib/rate-limiter'

jest.mock('@/lib/sequelize', () => ({
  sequelize: {
    transaction: jest.fn(async (callback: (t: any) => Promise<any>) => {
      const t = {}
      return callback(t)
    }),
  },
}))

jest.mock('@/lib/create-internal-session', () => ({
  createInternalSession: jest.fn(),
}))

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}))

jest.mock('@/lib/auth/session', () => ({
  getInternalSession: jest.fn(),
  isSessionError: jest.fn((r: any) => 'error' in r),
}))

const mockUserData: Record<string, any> = {}

function setupUserMocks(enrolled = true) {
  const save = jest.fn().mockImplementation(async function (this: any) {
    const key = this.id
    mockUserData[key] = { ...mockUserData[key], ...this }
  })

  const user = {
    id: 'target-user-uuid-2222',
    name: 'Target',
    surname: 'User',
    email: 'target@niticore.com',
    internal_role_id: 'role-implementation',
    status: 'active',
    totp_enabled: enrolled,
    totp_secret_encrypted: enrolled ? 'encrypted-v1' : null,
    totp_enrolled_at: enrolled ? new Date('2026-06-01') : null,
    last_totp_verified_at: enrolled ? new Date('2026-06-25') : null,
    failed_totp_attempt_count: 0,
    locked_until: null,
    totp_reset_at: null,
    totp_reset_by: null,
    totp_reset_reason: null,
    save,
  }

  mockUserData[user.id] = { ...user }
  return user
}

jest.mock('@/lib/models', () => {
  return {
    InternalUser: {
      findByPk: jest.fn(async (id: string) => {
        if (mockUserData[id]) {
          const data = mockUserData[id]
          return {
            ...data,
            save: jest.fn().mockImplementation(async function (this: any) {
              Object.assign(mockUserData[this.id], this)
            }),
          }
        }
        return null
      }),
    },
    MagicLink: {
      findOne: jest.fn(),
    },
    InternalAuditEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
  }
})

jest.mock('@/lib/totp', () => ({
  generateTotpSecret: jest.fn().mockReturnValue({
    base32: 'JBSWY3DPEHPK3PXP',
    ascii: 'test-secret',
    otpauth_url: 'otpauth://totp/test?secret=JBSWY3DPEHPK3PXP',
  }),
  generateQrCodeDataUri: jest.fn().mockResolvedValue('data:image/png;base64,test'),
  verifyTotpCode: jest.fn().mockReturnValue({ valid: true }),
  encryptSecret: jest.fn().mockReturnValue('encrypted-v2'),
  storeTempSecret: jest.fn(),
  retrieveTempSecret: jest.fn().mockReturnValue({
    base32: 'JBSWY3DPEHPK3PXP',
    ascii: 'test-secret',
    otpauth_url: 'otpauth://totp/test?secret=JBSWY3DPEHPK3PXP',
  }),
  deleteTempSecret: jest.fn(),
  clearTempSecrets: jest.fn(),
}))

jest.mock('@/lib/jwt', () => ({
  signTempToken: jest.fn().mockReturnValue('temp-token-for-test'),
  verifyTempToken: jest.fn().mockImplementation((token: string) => {
    if (token === 'temp-token-for-test') {
      return { sub: 'target-user-uuid-2222', purpose: 'totp', iat: 0, exp: 9999999999 }
    }
    if (token === 'temp-token-for-reset-test') {
      return { sub: 'target-user-uuid-2222', purpose: 'totp', iat: 0, exp: 9999999999 }
    }
    throw new Error('Invalid token')
  }),
}))

jest.mock('@/lib/rate-limiter', () => {
  const original = jest.requireActual('@/lib/rate-limiter')
  return {
    ...original,
    checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  }
})

import { getInternalSession } from '@/lib/auth/session'
import { InternalUser, InternalAuditEvent, MagicLink } from '@/lib/models'
import { POST as ResetPost } from '@/app/api/v1/internal/auth/admin/totp-reset/route'
import { POST as VerifyPost } from '@/app/api/v1/internal/auth/verify-magic-link/route'
import { POST as EnrollPost } from '@/app/api/v1/internal/auth/enroll-totp/route'
import * as totp from '@/lib/totp'

const mockGetInternalSession = getInternalSession as jest.MockedFunction<typeof getInternalSession>
const mockFindByPk = InternalUser.findByPk as jest.MockedFunction<typeof InternalUser.findByPk>
const mockMagicFindOne = MagicLink.findOne as jest.MockedFunction<typeof MagicLink.findOne>
const mockAuditCreate = InternalAuditEvent.create as jest.MockedFunction<typeof InternalAuditEvent.create>

const SUPER_ADMIN_ID = 'super-admin-uuid-1111'

function req(body: unknown, ip = '127.0.0.1'): NextRequest {
  return {
    json: async () => body,
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as NextRequest
}

function authReq(body: unknown, token: string, ip = '127.0.0.1'): NextRequest {
  return {
    json: async () => body,
    headers: new Headers({
      'x-forwarded-for': ip,
      'authorization': `Bearer ${token}`,
    }),
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  resetRateLimiter()
  Object.keys(mockUserData).forEach((k) => delete mockUserData[k])
})

describe('E2E: TOTP reset → re-enrollment flow (1d + 1b)', () => {
  it('user with TOTP sees totp_required on login before reset', async () => {
    setupUserMocks(true)
    mockMagicFindOne.mockResolvedValue({
      id: 'ml-1',
      token: 'valid-token',
      otp: '654321',
      email: 'target@niticore.com',
      internal_user_id: 'target-user-uuid-2222',
      purpose: 'login',
      consumed_at: null,
      expires_at: new Date(Date.now() + 600000),
      save: jest.fn().mockResolvedValue(undefined),
    })

    const res = await VerifyPost(req({ token: 'valid-token' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totp_required).toBe(true)
    expect(body.totp_enrollment_required).toBe(false)
    expect(body.temp_token).toBe('temp-token-for-test')
  })

  it('Super Admin resets user TOTP', async () => {
    setupUserMocks(true)

    mockGetInternalSession.mockResolvedValue({
      id: SUPER_ADMIN_ID,
      name: 'Super',
      surname: 'Admin',
      email: 'super@niticore.com',
      roleId: 'role-super-admin',
      roleName: 'Super Admin',
      status: 'active',
      totpEnabled: true,
      sessionId: 'session-12345',
    })

    const resetRes = await ResetPost(req({
      internal_user_id: 'target-user-uuid-2222',
      reason: 'Lost authenticator device',
    }))

    expect(resetRes.status).toBe(200)
    const resetBody = await resetRes.json()
    expect(resetBody.success).toBe(true)
    expect(resetBody.message).toContain('re-enroll')

    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_internal_user_id: SUPER_ADMIN_ID,
        action: 'totp_reset',
        target_id: 'target-user-uuid-2222',
      }),
      expect.any(Object),
    )

    expect(mockUserData['target-user-uuid-2222'].totp_enabled).toBe(false)
    expect(mockUserData['target-user-uuid-2222'].totp_secret_encrypted).toBe(null)
    expect(mockUserData['target-user-uuid-2222'].totp_reset_by).toBe(SUPER_ADMIN_ID)
    expect(mockUserData['target-user-uuid-2222'].totp_reset_reason).toBe('Lost authenticator device')
  })

  it('after reset, login detects totp_enrollment_required', async () => {
    setupUserMocks(false)

    mockMagicFindOne.mockResolvedValue({
      id: 'ml-2',
      token: 'post-reset-token',
      otp: '111222',
      email: 'target@niticore.com',
      internal_user_id: 'target-user-uuid-2222',
      purpose: 'login',
      consumed_at: null,
      expires_at: new Date(Date.now() + 600000),
      save: jest.fn().mockResolvedValue(undefined),
    })

    const res = await VerifyPost(req({ token: 'post-reset-token' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totp_required).toBe(false)
    expect(body.totp_enrollment_required).toBe(true)
    expect(typeof body.temp_token).toBe('string')
  })

  it('after reset, user can re-enroll TOTP (generate → confirm)', async () => {
    setupUserMocks(false)

    const genRes = await EnrollPost(authReq({}, 'temp-token-for-test'))

    expect(genRes.status).toBe(200)
    const genBody = await genRes.json()
    expect(genBody.qr_code).toBe('data:image/png;base64,test')
    expect(genBody.manual_key).toBe('JBSWY3DPEHPK3PXP')
    expect(totp.storeTempSecret).toHaveBeenCalledWith(
      'target-user-uuid-2222',
      expect.objectContaining({ base32: 'JBSWY3DPEHPK3PXP' }),
    )

    const confirmRes = await EnrollPost(authReq(
      { confirmation_code: '123456' },
      'temp-token-for-test',
    ))

    expect(confirmRes.status).toBe(200)
    const confirmBody = await confirmRes.json()
    expect(confirmBody.success).toBe(true)
    expect(confirmBody.message).toBe('TOTP enrollment successful')

    expect(mockUserData['target-user-uuid-2222'].totp_enabled).toBe(true)
    expect(mockUserData['target-user-uuid-2222'].totp_secret_encrypted).toBe('encrypted-v2')
    expect(mockUserData['target-user-uuid-2222'].totp_enrolled_at).toBeInstanceOf(Date)
  })

  it('after re-enrollment, login again returns totp_required', async () => {
    setupUserMocks(true)

    mockMagicFindOne.mockResolvedValue({
      id: 'ml-3',
      token: 're-enrolled-token',
      otp: '333444',
      email: 'target@niticore.com',
      internal_user_id: 'target-user-uuid-2222',
      purpose: 'login',
      consumed_at: null,
      expires_at: new Date(Date.now() + 600000),
      save: jest.fn().mockResolvedValue(undefined),
    })

    const res = await VerifyPost(req({ token: 're-enrolled-token' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totp_required).toBe(true)
    expect(body.totp_enrollment_required).toBe(false)
  })

  it('full end-to-end flow: enrolled → reset → re-enrollment detected → re-enroll → enrolled again', async () => {
    const user = setupUserMocks(true)

    mockGetInternalSession.mockResolvedValue({
      id: SUPER_ADMIN_ID,
      name: 'Super',
      surname: 'Admin',
      roleName: 'Super Admin',
      roleId: 'role-super-admin',
      status: 'active',
      totpEnabled: true,
      sessionId: 'session-e2e',
    } as any)

    mockMagicFindOne.mockImplementation(async (opts: any) => {
      const token = opts.where?.token
      return {
        id: `ml-${token || 'unknown'}`,
        token: token || 'unknown',
        otp: '555666',
        email: 'target@niticore.com',
        internal_user_id: 'target-user-uuid-2222',
        purpose: 'login',
        consumed_at: null,
        expires_at: new Date(Date.now() + 600000),
        save: jest.fn().mockResolvedValue(undefined),
      }
    })

    const preReset = await VerifyPost(req({ token: 'pre-reset' }))
    expect(preReset.status).toBe(200)
    const preBody = await preReset.json()
    expect(preBody.totp_required).toBe(true)
    expect(preBody.totp_enrollment_required).toBe(false)

    const resetRes = await ResetPost(req({
      internal_user_id: 'target-user-uuid-2222',
      reason: 'Lost device',
    }))
    expect(resetRes.status).toBe(200)

    const postReset = await VerifyPost(req({ token: 'post-reset' }))
    expect(postReset.status).toBe(200)
    const postBody = await postReset.json()
    expect(postBody.totp_required).toBe(false)
    expect(postBody.totp_enrollment_required).toBe(true)

    const genRes = await EnrollPost(authReq({}, 'temp-token-for-test'))
    expect(genRes.status).toBe(200)

    const confirmRes = await EnrollPost(authReq(
      { confirmation_code: '123456' },
      'temp-token-for-test',
    ))
    expect(confirmRes.status).toBe(200)
    expect(mockUserData['target-user-uuid-2222'].totp_enabled).toBe(true)

    const afterReEnroll = await VerifyPost(req({ token: 'after-re-enroll' }))
    expect(afterReEnroll.status).toBe(200)
    const reEnrolledBody = await afterReEnroll.json()
    expect(reEnrolledBody.totp_required).toBe(true)
    expect(reEnrolledBody.totp_enrollment_required).toBe(false)
  })
})
