import { DropboxSignAdapter } from '@/lib/esign/DropboxSignAdapter'
import { createESignAdapter } from '@/lib/esign'
import {
  validateSignerEmail,
  ESignProviderError,
  PlatformSigningStatus,
  CreateSigningRequestParams,
} from '@/lib/esign/types'
import { ESignAdapter } from '@/lib/esign/ESignAdapter'

const TEST_API_KEY = 'test_api_key_12345'

function mockFetch(responseData: unknown, status = 200, ok = true) {
  const mock = jest.fn().mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(responseData),
    text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
  })
  global.fetch = mock
  return mock
}

function mockFetchError(error: Error) {
  const mock = jest.fn().mockRejectedValue(error)
  global.fetch = mock
  return mock
}

beforeEach(() => {
  process.env.HELLOSIGN_API_KEY = TEST_API_KEY
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe('validateSignerEmail', () => {
  it('accepts valid email', () => {
    expect(validateSignerEmail('user@example.com')).toBe(true)
  })

  it('rejects email without @', () => {
    expect(validateSignerEmail('userexample.com')).toBe(false)
  })

  it('rejects email without domain', () => {
    expect(validateSignerEmail('user@')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateSignerEmail('')).toBe(false)
  })

  it('rejects email with spaces', () => {
    expect(validateSignerEmail('user @example.com')).toBe(false)
  })
})

describe('ESignProviderError', () => {
  it('creates a retryable error', () => {
    const err = new ESignProviderError('Network error', true, 'timeout')
    expect(err.message).toBe('Network error')
    expect(err.retryable).toBe(true)
    expect(err.providerError).toBe('timeout')
    expect(err.name).toBe('ESignProviderError')
  })

  it('creates a non-retryable error', () => {
    const err = new ESignProviderError('Invalid input', false)
    expect(err.retryable).toBe(false)
    expect(err.providerError).toBeUndefined()
  })
})

describe('createESignAdapter factory', () => {
  it('returns a DropboxSignAdapter for dropbox_sign', () => {
    const adapter = createESignAdapter('dropbox_sign', TEST_API_KEY)
    expect(adapter).toBeInstanceOf(DropboxSignAdapter)
    expect(adapter).toBeInstanceOf(ESignAdapter)
  })

  it('throws for unknown provider', () => {
    expect(() => createESignAdapter('unknown' as never)).toThrow('Unknown e-sign provider')
  })
})

describe('DropboxSignAdapter - validateCreateParams', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('throws error for empty signer list', async () => {
    await expect(
      adapter.createSigningRequest({ title: 'Test', signers: [], fileUrls: ['https://example.com/doc.pdf'] }),
    ).rejects.toThrow('At least one signer is required')
  })

  it('throws error for signer without name', async () => {
    await expect(
      adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: '', email: 'user@example.com' }],
        fileUrls: ['https://example.com/doc.pdf'],
      }),
    ).rejects.toThrow('Each signer must have a name and email')
  })

  it('throws error for signer without email', async () => {
    await expect(
      adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'John', email: '' }],
        fileUrls: ['https://example.com/doc.pdf'],
      }),
    ).rejects.toThrow('Each signer must have a name and email')
  })

  it('throws error for invalid signer email', async () => {
    await expect(
      adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'John', email: 'not-an-email' }],
        fileUrls: ['https://example.com/doc.pdf'],
      }),
    ).rejects.toThrow('Invalid signer email')
  })
})

describe('DropboxSignAdapter - buildCreatePayload', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('builds basic payload with signers', () => {
    const params: CreateSigningRequestParams = {
      title: 'NDA Agreement',
      message: 'Please sign this NDA',
      signers: [
        { name: 'Alice', email: 'alice@example.com', order: 1 },
        { name: 'Bob', email: 'bob@example.com', order: 2 },
      ],
    }
    const payload = adapter.buildCreatePayload(params) as Record<string, unknown>
    expect(payload.title).toBe('NDA Agreement')
    expect(payload.subject).toBe('NDA Agreement')
    expect(payload.message).toBe('Please sign this NDA')
    expect(payload.signers).toEqual([
      { name: 'Alice', email_address: 'alice@example.com', order: 1 },
      { name: 'Bob', email_address: 'bob@example.com', order: 2 },
    ])
    expect(payload.test_mode).toBe(1)
  })

  it('sets test_mode to 1', () => {
    const params: CreateSigningRequestParams = {
      title: 'Test',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
    }
    const payload = adapter.buildCreatePayload(params)
    expect(payload.test_mode).toBe(1)
  })

  it('includes file_urls when provided', () => {
    const params: CreateSigningRequestParams = {
      title: 'Test',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
      fileUrls: ['https://example.com/doc.pdf'],
    }
    const payload = adapter.buildCreatePayload(params) as Record<string, unknown>
    expect(payload.file_urls).toEqual(['https://example.com/doc.pdf'])
    expect(payload.files).toBeUndefined()
  })

  it('includes cc email addresses from signers with cc role', () => {
    const params: CreateSigningRequestParams = {
      title: 'Test',
      signers: [
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Clara', email: 'clara@example.com', role: 'cc' },
      ],
      ccEmailAddresses: ['lawyer@example.com'],
    }
    const payload = adapter.buildCreatePayload(params) as Record<string, unknown>
    expect(payload.cc_email_addresses).toEqual(['clara@example.com', 'lawyer@example.com'])
    const signers = payload.signers as Array<{ name: string; email_address: string }>
    expect(signers).toHaveLength(1)
    expect(signers[0].name).toBe('Alice')
  })

  it('includes expires_in when expiresInDays provided', () => {
    const params: CreateSigningRequestParams = {
      title: 'Test',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
      expiresInDays: 14,
    }
    const payload = adapter.buildCreatePayload(params) as Record<string, unknown>
    expect(payload.expires_in).toBe(14)
  })

  it('includes client_id when provided', () => {
    const params: CreateSigningRequestParams = {
      title: 'Test',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
      clientId: 'abc123',
    }
    const payload = adapter.buildCreatePayload(params) as Record<string, unknown>
    expect(payload.client_id).toBe('abc123')
  })
})

describe('DropboxSignAdapter - mapProviderStatusToPlatform', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  const cases: Array<[string, PlatformSigningStatus]> = [
    ['awaiting_signature', 'sent'],
    ['awaiting_approval', 'sent'],
    ['signed', 'signed'],
    ['declined', 'declined'],
    ['expired', 'expired'],
    ['voided', 'voided'],
    ['errored', 'error'],
    ['sent', 'sent'],
    ['unknown_status', 'draft'],
  ]

  it.each(cases)('maps %s to %s', (providerStatus, expected) => {
    expect(adapter.mapProviderStatusToPlatform(providerStatus)).toBe(expected)
  })
})

describe('DropboxSignAdapter - parseCreateResponse', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('parses successful create response', () => {
    const response = {
      signature_request: {
        signature_request_id: 'sr_abc123',
        status: 'awaiting_signature',
        signing_url: 'https://sign.hellosign.com/sign/abc123',
      },
    }
    const result = adapter.parseCreateResponse(response)
    expect(result.envelopeId).toBe('sr_abc123')
    expect(result.providerName).toBe('dropbox_sign')
    expect(result.status).toBe('sent')
    expect(result.signUrl).toBe('https://sign.hellosign.com/sign/abc123')
    expect(result.errorMessage).toBeUndefined()
  })

  it('returns error status when provider returns error', () => {
    const response = {
      error: {
        error_msg: 'Invalid request',
        error_name: 'bad_request',
      },
    }
    const result = adapter.parseCreateResponse(response)
    expect(result.status).toBe('error')
    expect(result.errorMessage).toBe('Invalid request')
  })

  it('returns error when signature_request_id is missing', () => {
    const response = { signature_request: { status: 'draft' } }
    const result = adapter.parseCreateResponse(response)
    expect(result.status).toBe('error')
    expect(result.errorMessage).toContain('missing signature_request_id')
  })

  it('returns pending_send for draft status', () => {
    const response = {
      signature_request: {
        signature_request_id: 'sr_abc123',
        status: 'draft',
      },
    }
    const result = adapter.parseCreateResponse(response)
    expect(result.status).toBe('pending_send')
  })
})

describe('DropboxSignAdapter - parseSendResponse', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('parses successful send response', () => {
    const response = {
      signature_request: {
        signature_request_id: 'sr_abc123',
        status: 'sent',
      },
    }
    const result = adapter.parseSendResponse(response)
    expect(result.envelopeId).toBe('sr_abc123')
    expect(result.status).toBe('sent')
    expect(result.sentAt).toBeTruthy()
    expect(typeof result.sentAt).toBe('string')
  })

  it('returns error status on provider error', () => {
    const response = {
      error: {
        error_msg: 'Signature request not found',
        error_name: 'not_found',
      },
    }
    const result = adapter.parseSendResponse(response)
    expect(result.status).toBe('error')
    expect(result.errorMessage).toBe('Signature request not found')
  })

  it('returns error status when errored', () => {
    const response = {
      signature_request: {
        signature_request_id: 'sr_abc123',
        status: 'errored',
        error: 'Something went wrong',
      },
    }
    const result = adapter.parseSendResponse(response)
    expect(result.status).toBe('error')
    expect(result.errorMessage).toBe('Something went wrong')
  })
})

describe('DropboxSignAdapter - parseStatusResponse', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('parses status with signed signer', () => {
    const now = Math.floor(Date.now() / 1000)
    const response = {
      signature_request: {
        signature_request_id: 'sr_abc123',
        status: 'signed',
        signatures: [
          {
            signer_email_address: 'alice@example.com',
            status_code: 'signed',
            signed_at: now,
          },
        ],
      },
    }
    const result = adapter.parseStatusResponse(response)
    expect(result.envelopeId).toBe('sr_abc123')
    expect(result.platformStatus).toBe('signed')
    expect(result.signers).toHaveLength(1)
    expect(result.signers[0].email).toBe('alice@example.com')
    expect(result.signers[0].status).toBe('signed')
    expect(result.signers[0].signedAt).toBeTruthy()
  })

  it('returns error when provider returns error', () => {
    const response = {
      error: {
        error_msg: 'Not found',
        error_name: 'not_found',
      },
    }
    const result = adapter.parseStatusResponse(response)
    expect(result.platformStatus).toBe('error')
  })

  it('handles missing signatures array', () => {
    const response = {
      signature_request: {
        signature_request_id: 'sr_abc123',
        status: 'awaiting_signature',
      },
    }
    const result = adapter.parseStatusResponse(response)
    expect(result.platformStatus).toBe('sent')
    expect(result.signers).toEqual([])
  })
})

describe('DropboxSignAdapter - buildLegalDocumentUpdate', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('builds update from create result', () => {
    const result = {
      envelopeId: 'sr_abc123',
      providerName: 'dropbox_sign' as const,
      status: 'pending_send' as const,
    }
    const update = adapter.buildLegalDocumentUpdate(result)
    expect(update.provider_envelope_id).toBe('sr_abc123')
    expect(update.provider_status).toBe('')
    expect(update.platform_status).toBe('draft')
  })

  it('includes sent_at from send result', () => {
    const result = {
      envelopeId: 'sr_abc123',
      providerName: 'dropbox_sign' as const,
      status: 'sent' as const,
      sentAt: '2026-06-29T12:00:00.000Z',
    }
    const update = adapter.buildLegalDocumentUpdate(result)
    expect(update.sent_at).toEqual(new Date('2026-06-29T12:00:00.000Z'))
  })
})

describe('DropboxSignAdapter - createSigningRequest integration', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('sends API request and returns create result', async () => {
    const responseData = {
      signature_request: {
        signature_request_id: 'sr_abc123',
        status: 'awaiting_signature',
        signing_url: 'https://sign.hellosign.com/sign/abc123',
      },
    }
    mockFetch(responseData)

    const result = await adapter.createSigningRequest({
      title: 'NDA',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
      fileUrls: ['https://example.com/doc.pdf'],
    })

    expect(result.envelopeId).toBe('sr_abc123')
    expect(result.status).toBe('sent')
    expect(result.signUrl).toBe('https://sign.hellosign.com/sign/abc123')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries once on network error then succeeds', async () => {
    jest.useFakeTimers()
    const responseData = {
      signature_request: {
        signature_request_id: 'sr_retry',
        status: 'awaiting_signature',
      },
    }

    const mock = jest.fn()
    mock.mockRejectedValueOnce(new TypeError('fetch failed'))
    mock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responseData),
      text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
    })
    global.fetch = mock

    const resultPromise = adapter.createSigningRequest({
      title: 'NDA',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
      fileUrls: ['https://example.com/doc.pdf'],
    })

    await jest.advanceTimersByTimeAsync(2000)
    const result = await resultPromise

    expect(result.envelopeId).toBe('sr_retry')
    expect(mock).toHaveBeenCalledTimes(2)
  })

  it('throws after retries exhausted on persistent network error', async () => {
    jest.useFakeTimers()
    const mock = jest.fn().mockRejectedValue(new TypeError('network unreachable'))
    global.fetch = mock

    const resultPromise = adapter.createSigningRequest({
      title: 'NDA',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
      fileUrls: ['https://example.com/doc.pdf'],
    }).catch((e) => e)

    await jest.advanceTimersByTimeAsync(2000)
    const error = await resultPromise

    expect(error).toBeInstanceOf(ESignProviderError)
    expect(error.retryable).toBe(true)
    expect(mock).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid input before API call', async () => {
    const mock = mockFetch({})
    await expect(
      adapter.createSigningRequest({
        title: 'Test',
        signers: [],
      }),
    ).rejects.toThrow('At least one signer is required')

    expect(mock).not.toHaveBeenCalled()
  })

  it('rejects signer with invalid email before API call', async () => {
    const mock = mockFetch({})
    await expect(
      adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'John', email: 'bad-email' }],
      }),
    ).rejects.toThrow('Invalid signer email')

    expect(mock).not.toHaveBeenCalled()
  })
})

describe('DropboxSignAdapter - sendSigningRequest errors', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('throws when envelopeId is empty', async () => {
    await expect(adapter.sendSigningRequest('')).rejects.toThrow('envelopeId is required')
  })

  it('handles 401 unauthorized', async () => {
    mockFetch({ error: { error_msg: 'Unauthorized', error_name: 'unauthorized' } }, 401, false)
    await expect(adapter.sendSigningRequest('sr_abc')).rejects.toThrow('Invalid Dropbox Sign API key')
  })

  it('handles 429 rate limit', async () => {
    mockFetch({ error: { error_msg: 'Rate limited', error_name: 'rate_limit' } }, 429, false)
    const err = await adapter.sendSigningRequest('sr_abc').catch((e) => e)
    expect(err.retryable).toBe(true)
    expect(err.message).toContain('Rate limited')
  })

  it('handles 500 server error', async () => {
    mockFetch({ error: { error_msg: 'Server error', error_name: 'server_error' } }, 500, false)
    const err = await adapter.sendSigningRequest('sr_abc').catch((e) => e)
    expect(err.retryable).toBe(true)
  })

  it('throws on network error', async () => {
    mockFetchError(new TypeError('fetch failed'))
    const err = await adapter.sendSigningRequest('sr_abc').catch((e) => e)
    expect(err).toBeInstanceOf(ESignProviderError)
    expect(err.retryable).toBe(true)
  })

  it('handles timeout (AbortError)', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    mockFetchError(abortError)
    const err = await adapter.sendSigningRequest('sr_abc').catch((e) => e)
    expect(err.retryable).toBe(true)
    expect(err.message).toContain('timed out')
  })
})

describe('DropboxSignAdapter - missing API key', () => {
  it('throws when no API key configured', async () => {
    delete process.env.HELLOSIGN_API_KEY
    const adapter = new DropboxSignAdapter()
    await expect(
      adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
        fileUrls: ['https://example.com/doc.pdf'],
      }),
    ).rejects.toThrow('HELLOSIGN_API_KEY is not configured')
  })

  it('uses constructor apiKey over env var', async () => {
    const adapter = new DropboxSignAdapter('constructor_key')
    const responseData = {
      signature_request: {
        signature_request_id: 'sr_constructor',
        status: 'awaiting_signature',
      },
    }
    mockFetch(responseData)

    const result = await adapter.createSigningRequest({
      title: 'Test',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
      fileUrls: ['https://example.com/doc.pdf'],
    })

    expect(result.envelopeId).toBe('sr_constructor')
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const authHeader = fetchCall[1].headers['Authorization']
    expect(authHeader).toBe(
      'Basic ' + Buffer.from('constructor_key:').toString('base64'),
    )
  })
})

describe('DropboxSignAdapter - getSigningRequestStatus', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('fetches and parses envelope status', async () => {
    const responseData = {
      signature_request: {
        signature_request_id: 'sr_abc123',
        status: 'signed',
        signatures: [
          {
            signer_email_address: 'alice@example.com',
            status_code: 'signed',
            signed_at: 1782620800,
          },
        ],
      },
    }
    mockFetch(responseData)

    const result = await adapter.getSigningRequestStatus('sr_abc123')
    expect(result.platformStatus).toBe('signed')
    expect(result.signers).toHaveLength(1)
    const expectedDate = new Date(1782620800 * 1000).toISOString()
    expect(result.signers[0].signedAt).toBe(expectedDate)
  })

  it('throws for empty envelopeId', async () => {
    await expect(adapter.getSigningRequestStatus('')).rejects.toThrow('envelopeId is required')
  })
})

describe('DropboxSignAdapter - file size validation in create', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('rejects files exceeding 20MB total', async () => {
    const largeBuffer = Buffer.alloc(21 * 1024 * 1024)
    const mock = mockFetch({})

    await expect(
      adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
        fileBytes: [{ filename: 'large.pdf', content: largeBuffer }],
      }),
    ).rejects.toThrow('exceeds provider limit')
    expect(mock).not.toHaveBeenCalled()
  })

  it('accepts files under 20MB total', async () => {
    const smallBuffer = Buffer.alloc(1024)
    const responseData = {
      signature_request: {
        signature_request_id: 'sr_small',
        status: 'awaiting_signature',
      },
    }
    mockFetch(responseData)

    const result = await adapter.createSigningRequest({
      title: 'Test',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
      fileBytes: [{ filename: 'small.pdf', content: smallBuffer }],
    })

    expect(result.envelopeId).toBe('sr_small')
  })
})

describe('DropboxSignAdapter - isNetworkError', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('returns false for ESignProviderError', () => {
    const err = new ESignProviderError('test', false)
    expect(adapter['isNetworkError'](err)).toBe(false)
  })

  it('returns true for TypeError', () => {
    const err = new TypeError('fetch failed')
    expect(adapter['isNetworkError'](err)).toBe(true)
  })

  it('returns true for ECONNRESET', () => {
    const err = { code: 'ECONNRESET' }
    expect(adapter['isNetworkError'](err)).toBe(true)
  })

  it('returns false for random errors', () => {
    const err = new Error('random')
    expect(adapter['isNetworkError'](err)).toBe(false)
  })
})

describe('ESignAdapter - validateCreateParams (via concrete subclass)', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('passes for valid params', () => {
    const params: CreateSigningRequestParams = {
      title: 'Test',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
    }
    expect(() => adapter.buildCreatePayload(params)).not.toThrow()
  })
})

describe('Error types', () => {
  it('AdapterError has correct name and code', () => {
    const err = new (require('@/lib/esign/types').AdapterError)('test', 'TEST_CODE')
    expect(err.name).toBe('AdapterError')
    expect(err.code).toBe('TEST_CODE')
    expect(err.retryable).toBe(false)
  })

  it('EnvelopeNotFoundError has correct code', () => {
    const { EnvelopeNotFoundError: Err } = require('@/lib/esign/types')
    const err = new Err('custom message')
    expect(err.name).toBe('EnvelopeNotFoundError')
    expect(err.code).toBe('ENVELOPE_NOT_FOUND')
    expect(err.message).toBe('custom message')
  })

  it('EnvelopeAlreadyCompletedError has correct code', () => {
    const { EnvelopeAlreadyCompletedError: Err } = require('@/lib/esign/types')
    const err = new Err()
    expect(err.name).toBe('EnvelopeAlreadyCompletedError')
    expect(err.code).toBe('ENVELOPE_ALREADY_COMPLETED')
  })

  it('DocumentNotReadyError has correct code', () => {
    const { DocumentNotReadyError: Err } = require('@/lib/esign/types')
    const err = new Err()
    expect(err.name).toBe('DocumentNotReadyError')
    expect(err.code).toBe('DOCUMENT_NOT_READY')
  })

  it('DocumentNotAvailableError has correct code', () => {
    const { DocumentNotAvailableError: Err } = require('@/lib/esign/types')
    const err = new Err()
    expect(err.name).toBe('DocumentNotAvailableError')
    expect(err.code).toBe('DOCUMENT_NOT_AVAILABLE')
  })
})

describe('MockESignProvider', () => {
  let adapter: import('@/lib/esign/types').ESignAdapter
  const MockProvider = require('@/lib/esign/MockESignProvider').MockESignProvider
  const { EnvelopeNotFoundError: EnfNF, EnvelopeAlreadyCompletedError: EnfComp, DocumentNotReadyError: DocNR, DocumentNotAvailableError: DocNA } = require('@/lib/esign/types')

  beforeEach(() => {
    adapter = new MockProvider()
  })

  describe('createSigningRequest', () => {
    it('creates and returns a signing request', async () => {
      const result = await adapter.createSigningRequest({
        title: 'Test Agreement',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
        fileUrls: ['https://example.com/doc.pdf'],
      })

      expect(result.envelopeId).toMatch(/^mock_/)
      expect(result.providerName).toBe('mock')
      expect(result.status).toBe('sent')
      expect(result.signUrl).toContain(result.envelopeId)
    })

    it('rejects empty signers', async () => {
      await expect(
        adapter.createSigningRequest({ title: 'Test', signers: [] }),
      ).rejects.toThrow('At least one signer is required')
    })

    it('rejects invalid email', async () => {
      await expect(
        adapter.createSigningRequest({
          title: 'Test',
          signers: [{ name: 'John', email: 'bad-email' }],
        }),
      ).rejects.toThrow('Invalid signer email')
    })
  })

  describe('sendSigningRequest', () => {
    it('sends an existing envelope', async () => {
      const created = await adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
      })

      const result = await adapter.sendSigningRequest(created.envelopeId)
      expect(result.status).toBe('sent')
      expect(result.envelopeId).toBe(created.envelopeId)
    })

    it('throws EnvelopeNotFoundError for unknown envelope', async () => {
      try {
        await adapter.sendSigningRequest('nonexistent')
        fail('Expected error')
      } catch (err) {
        expect(err).toBeInstanceOf(EnfNF)
      }
    })

    it('throws when envelopeId is empty', async () => {
      await expect(adapter.sendSigningRequest('')).rejects.toThrow('envelopeId is required')
    })
  })

  describe('getSigningRequestStatus', () => {
    it('returns status for existing envelope', async () => {
      const created = await adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
      })

      const status = await adapter.getSigningRequestStatus(created.envelopeId)
      expect(status.platformStatus).toBe('sent')
      expect(status.envelopeId).toBe(created.envelopeId)
    })

    it('throws EnvelopeNotFoundError for unknown envelope', async () => {
      try {
        await adapter.getSigningRequestStatus('nonexistent')
        fail('Expected error')
      } catch (err) {
        expect(err).toBeInstanceOf(EnfNF)
      }
    })
  })

  describe('voidSigningRequest', () => {
    it('voids an existing envelope', async () => {
      const created = await adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
      })

      const result = await adapter.voidSigningRequest(created.envelopeId, 'Changed mind')
      expect(result.platformStatus).toBe('voided')
      expect(result.voidedAt).toBeTruthy()
    })

    it('is idempotent when voiding an already-voided envelope', async () => {
      const created = await adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
      })

      await adapter.voidSigningRequest(created.envelopeId)
      const result = await adapter.voidSigningRequest(created.envelopeId)
      expect(result.platformStatus).toBe('voided')
    })

    it('throws EnvelopeAlreadyCompletedError for signed envelope', async () => {
      const created = await adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
      })

      await adapter.sendSigningRequest(created.envelopeId)
      adapter.simulateSigning(created.envelopeId)

      try {
        await adapter.voidSigningRequest(created.envelopeId)
        fail('Expected EnvelopeAlreadyCompletedError')
      } catch (err) {
        expect(err).toBeInstanceOf(EnfComp)
      }
    })

    it('throws EnvelopeNotFoundError for unknown envelope', async () => {
      try {
        await adapter.voidSigningRequest('nonexistent')
        fail('Expected EnvelopeNotFoundError')
      } catch (err) {
        expect(err).toBeInstanceOf(EnfNF)
      }
    })

    it('throws when envelopeId is empty', async () => {
      await expect(adapter.voidSigningRequest('')).rejects.toThrow('envelopeId is required')
    })
  })

  describe('downloadSignedDocument', () => {
    it('downloads a signed document', async () => {
      const created = await adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
      })

      await adapter.sendSigningRequest(created.envelopeId)
      adapter.simulateSigning(created.envelopeId)

      const doc = await adapter.downloadSignedDocument(created.envelopeId)
      expect(doc.envelopeId).toBe(created.envelopeId)
      expect(doc.fileName).toMatch(/\.pdf$/)
      expect(doc.fileType).toBe('application/pdf')
      expect(doc.fileSizeBytes).toBeGreaterThan(0)
      expect(doc.content).toBeInstanceOf(Buffer)
    })

    it('throws DocumentNotReadyError for unsigned envelope', async () => {
      const created = await adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
      })

      try {
        await adapter.downloadSignedDocument(created.envelopeId)
        fail('Expected DocumentNotReadyError')
      } catch (err) {
        expect(err).toBeInstanceOf(DocNR)
      }
    })

    it('throws DocumentNotAvailableError for voided envelope', async () => {
      const created = await adapter.createSigningRequest({
        title: 'Test',
        signers: [{ name: 'Alice', email: 'alice@example.com' }],
      })

      await adapter.voidSigningRequest(created.envelopeId)

      try {
        await adapter.downloadSignedDocument(created.envelopeId)
        fail('Expected DocumentNotAvailableError')
      } catch (err) {
        expect(err).toBeInstanceOf(DocNA)
      }
    })

    it('throws EnvelopeNotFoundError for unknown envelope', async () => {
      try {
        await adapter.downloadSignedDocument('nonexistent')
        fail('Expected EnvelopeNotFoundError')
      } catch (err) {
        expect(err).toBeInstanceOf(EnfNF)
      }
    })

    it('throws when envelopeId is empty', async () => {
      await expect(adapter.downloadSignedDocument('')).rejects.toThrow('envelopeId is required')
    })
  })

  describe('mock provider in factory', () => {
    it('can be created via the factory', () => {
      const mocks = createESignAdapter('mock')
      expect(mocks.constructor.name).toBe('MockESignProvider')
    })

    it('implements the same interface as DropboxSignAdapter', () => {
      const mock = createESignAdapter('mock')
      const dropbox = createESignAdapter('dropbox_sign', TEST_API_KEY)

      const mockMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(mock)).sort()
      const dropboxMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(dropbox)).sort()

      const sharedMethods = mockMethods.filter((m) => dropboxMethods.includes(m) && m !== 'constructor')
      expect(sharedMethods).toContain('createSigningRequest')
      expect(sharedMethods).toContain('sendSigningRequest')
      expect(sharedMethods).toContain('getSigningRequestStatus')
      expect(sharedMethods).toContain('voidSigningRequest')
      expect(sharedMethods).toContain('downloadSignedDocument')
      expect(sharedMethods).toContain('buildLegalDocumentUpdate')
    })
  })
})

describe('Provider-swap verification', () => {
  const { MockESignProvider: MockProv } = require('@/lib/esign/MockESignProvider')

  async function exerciseProviderAdapter(adapter: import('@/lib/esign/types').ESignAdapter, envelopeId?: string) {
    if (envelopeId) {
      await adapter.sendSigningRequest(envelopeId)
      return adapter.getSigningRequestStatus(envelopeId)
    }

    const createResult = await adapter.createSigningRequest({
      title: 'Provider Swap Test',
      signers: [{ name: 'Swap Tester', email: 'swap@test.com' }],
    })
    await adapter.sendSigningRequest(createResult.envelopeId)
    return adapter.getSigningRequestStatus(createResult.envelopeId)
  }

  it('works identically with DropboxSignAdapter and MockESignProvider when calling code is unchanged', async () => {
    const mockAdapter = new MockProv()

    const mockResult = await exerciseProviderAdapter(mockAdapter)
    expect(mockResult.platformStatus).toBe('sent')

    const dropboxAdapter = new DropboxSignAdapter(TEST_API_KEY)
    const responseData = {
      signature_request: {
        signature_request_id: 'sr_swap_test',
        status: 'awaiting_signature',
        signatures: [],
      },
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responseData),
      text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
    })

    const dropboxResult = await exerciseProviderAdapter(dropboxAdapter, 'sr_swap_test')
    expect(dropboxResult.platformStatus).toBe(mockResult.platformStatus)

    jest.restoreAllMocks()
  })

  it('the same function works with mock via DI', async () => {
    const adapter: import('@/lib/esign/types').ESignAdapter = createESignAdapter('mock')

    const result = await exerciseProviderAdapter(adapter)
    expect(result.envelopeId).toMatch(/^mock_/)
    expect(result.platformStatus).toBe('sent')
  })
})

describe('DropboxSignAdapter - voidSigningRequest', () => {
  let adapter: DropboxSignAdapter
  const { EnvelopeAlreadyCompletedError: EnfComp, EnvelopeNotFoundError: EnfNF } = require('@/lib/esign/types')

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('sends cancel request and returns voided result', async () => {
    const responseData = {
      signature_request: {
        signature_request_id: 'sr_void_test',
        status: 'voided',
      },
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responseData),
      text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
    })

    const result = await adapter.voidSigningRequest('sr_void_test', 'No longer needed')
    expect(result.platformStatus).toBe('voided')
    expect(result.voidedAt).toBeTruthy()
    expect(result.envelopeId).toBe('sr_void_test')

    jest.restoreAllMocks()
  })

  it('throws for empty envelopeId', async () => {
    await expect(adapter.voidSigningRequest('')).rejects.toThrow('envelopeId is required')
  })

  it('handles 404 from provider', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn().mockResolvedValue({ error: { error_name: 'not_found', error_msg: 'Not found' } }),
      text: jest.fn().mockResolvedValue('Not found'),
    })

    try {
      await adapter.voidSigningRequest('sr_nonexistent')
      fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(EnfNF)
    }

    jest.restoreAllMocks()
  })

  it('throws EnvelopeAlreadyCompletedError for signed envelope', async () => {
    const responseData = {
      signature_request: {
        signature_request_id: 'sr_signed',
        status: 'signed',
      },
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(responseData),
      text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
    })

    try {
      await adapter.voidSigningRequest('sr_signed')
      fail('Expected EnvelopeAlreadyCompletedError')
    } catch (err) {
      expect(err).toBeInstanceOf(EnfComp)
    }

    jest.restoreAllMocks()
  })

  it('handles 401 unauthorized', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({ error: { error_name: 'unauthorized', error_msg: 'Unauthorized' } }),
      text: jest.fn().mockResolvedValue('Unauthorized'),
    })

    await expect(adapter.voidSigningRequest('sr_abc')).rejects.toThrow('Invalid Dropbox Sign API key')

    jest.restoreAllMocks()
  })

  it('handles 429 rate limit', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({ error: { error_name: 'rate_limit', error_msg: 'Rate limited' } }),
      text: jest.fn().mockResolvedValue('Rate limited'),
    })

    const err = await adapter.voidSigningRequest('sr_abc').catch((e) => e)
    expect(err.retryable).toBe(true)

    jest.restoreAllMocks()
  })
})

describe('DropboxSignAdapter - parseVoidResponse', () => {
  let adapter: DropboxSignAdapter
  const { EnvelopeAlreadyCompletedError: EnfComp } = require('@/lib/esign/types')

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('parses successful void response', () => {
    const response = {
      signature_request: {
        signature_request_id: 'sr_void',
        status: 'voided',
      },
    }
    const result = adapter.parseVoidResponse(response, 'sr_void')
    expect(result.platformStatus).toBe('voided')
    expect(result.voidedAt).toBeTruthy()
  })

  it('returns error status when provider returns error', () => {
    const response = {
      error: { error_msg: 'Not found', error_name: 'not_found' },
    }
    expect(() => adapter.parseVoidResponse(response, 'sr_notfound')).toThrow('not found')
  })

  it('throws for already signed envelope', () => {
    const response = {
      signature_request: {
        signature_request_id: 'sr_signed',
        status: 'signed',
      },
    }
    expect(() => adapter.parseVoidResponse(response, 'sr_signed')).toThrow(EnfComp)
  })
})

describe('DropboxSignAdapter - downloadSignedDocument', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('downloads PDF binary and returns document info', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 mock binary content')
    const arrayBuffer = pdfContent.buffer.slice(pdfContent.byteOffset, pdfContent.byteOffset + pdfContent.length)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([
        ['content-type', 'application/pdf'],
        ['content-disposition', 'attachment; filename="agreement.pdf"'],
      ]),
      arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
    })

    const doc = await adapter.downloadSignedDocument('sr_doc_test')
    expect(doc.envelopeId).toBe('sr_doc_test')
    expect(doc.fileName).toBe('agreement.pdf')
    expect(doc.fileType).toBe('application/pdf')
    expect(doc.fileSizeBytes).toBe(pdfContent.length)
    expect(Buffer.from(doc.content)).toEqual(pdfContent)
  })

  it('uses envelopeId as fallback filename when no content-disposition', async () => {
    const pdfContent = Buffer.from('%PDF-1.4 mock')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([
        ['content-type', 'application/pdf'],
      ]),
      arrayBuffer: jest.fn().mockResolvedValue(pdfContent.buffer),
    })

    const doc = await adapter.downloadSignedDocument('sr_fallback')
    expect(doc.fileName).toBe('sr_fallback.pdf')
  })

  it('throws for empty envelopeId', async () => {
    await expect(adapter.downloadSignedDocument('')).rejects.toThrow('envelopeId is required')
  })

  it('handles 401 unauthorized', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Map(),
      text: jest.fn().mockResolvedValue('Unauthorized'),
    })

    await expect(adapter.downloadSignedDocument('sr_abc')).rejects.toThrow('Invalid Dropbox Sign API key')
  })

  it('handles 404 not found', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Map(),
      text: jest.fn().mockResolvedValue('Not found'),
    })

    const { EnvelopeNotFoundError: EnfNF } = require('@/lib/esign/types')
    try {
      await adapter.downloadSignedDocument('sr_nonexistent')
      fail('Expected error')
    } catch (err) {
      expect(err).toBeInstanceOf(EnfNF)
    }
  })
})

describe('DropboxSignAdapter - buildLegalDocumentUpdate with void', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('includes voided_at for VoidSigningRequestResult', () => {
    const result = {
      envelopeId: 'sr_void',
      providerName: 'dropbox_sign' as const,
      providerStatus: 'voided',
      platformStatus: 'voided' as const,
      voidedAt: '2026-06-29T12:00:00.000Z',
    }
    const update = adapter.buildLegalDocumentUpdate(result)
    expect(update.voided_at).toEqual(new Date('2026-06-29T12:00:00.000Z'))
    expect(update.platform_status).toBe('voided')
  })
})

describe('Factory with mock provider', () => {
  it('creates mock provider via factory using mock name', () => {
    const adapter = createESignAdapter('mock')
    expect(adapter.constructor.name).toBe('MockESignProvider')
  })

  it('mock provider full lifecycle works', async () => {
    const adapter = createESignAdapter('mock')

    const createResult = await adapter.createSigningRequest({
      title: 'Lifecycle Test',
      signers: [{ name: 'Alice', email: 'alice@example.com' }],
    })
    expect(createResult.status).toBe('sent')

    const sendResult = await adapter.sendSigningRequest(createResult.envelopeId)
    expect(sendResult.status).toBe('sent')

    const voidResult = await adapter.voidSigningRequest(createResult.envelopeId)
    expect(voidResult.platformStatus).toBe('voided')

    const status = await adapter.getSigningRequestStatus(createResult.envelopeId)
    expect(status.platformStatus).toBe('voided')
  })
})

const crypto = require('crypto')

function validWebhookPayload(eventType: string, envelopeId = 'sr_wh_test'): string {
  return JSON.stringify({
    signature_request: { signature_request_id: envelopeId },
    event: { event_type: eventType, event_time: Math.floor(Date.now() / 1000).toString() },
  })
}

function computeSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(Buffer.from(payload, 'utf-8')).digest('hex')
}

describe('DropboxSignAdapter - verifyWebhookSignature', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('accepts a valid signature', () => {
    const payload = validWebhookPayload('signature_request_signed')
    const signature = computeSignature(payload, TEST_API_KEY)
    expect(adapter.verifyWebhookSignature(Buffer.from(payload, 'utf-8'), signature)).toBe(true)
  })

  it('rejects an invalid signature', () => {
    const payload = validWebhookPayload('signature_request_signed')
    expect(adapter.verifyWebhookSignature(Buffer.from(payload, 'utf-8'), 'bad_signature')).toBe(false)
  })

  it('rejects when signature header is empty', () => {
    const payload = validWebhookPayload('signature_request_signed')
    expect(adapter.verifyWebhookSignature(Buffer.from(payload, 'utf-8'), '')).toBe(false)
  })

  it('returns false when API key is not configured', () => {
    const adapterNoKey = new DropboxSignAdapter('')
    const payload = validWebhookPayload('signature_request_signed')
    const signature = computeSignature(payload, '')
    expect(adapterNoKey.verifyWebhookSignature(Buffer.from(payload, 'utf-8'), signature)).toBe(false)
  })
})

describe('DropboxSignAdapter - parseWebhookEvent', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('parses signature_request_signed event', () => {
    const payload = validWebhookPayload('signature_request_signed')
    const event = adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))
    expect(event.envelopeId).toBe('sr_wh_test')
    expect(event.eventType).toBe('signed')
    expect(event.providerRawEvent).toBe('signature_request_signed')
    expect(event.occurredAt).toBeTruthy()
  })

  it('parses signature_request_sent event', () => {
    const payload = validWebhookPayload('signature_request_sent')
    const event = adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))
    expect(event.eventType).toBe('sent')
  })

  it('parses signature_request_viewed event', () => {
    const payload = validWebhookPayload('signature_request_viewed')
    const event = adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))
    expect(event.eventType).toBe('viewed')
  })

  it('parses signature_request_declined event', () => {
    const payload = validWebhookPayload('signature_request_declined')
    const event = adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))
    expect(event.eventType).toBe('declined')
  })

  it('parses signature_request_expired event', () => {
    const payload = validWebhookPayload('signature_request_expired')
    const event = adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))
    expect(event.eventType).toBe('expired')
  })

  it('parses signature_request_canceled event', () => {
    const payload = validWebhookPayload('signature_request_canceled')
    const event = adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))
    expect(event.eventType).toBe('voided')
  })

  it('throws for invalid JSON', () => {
    expect(() => adapter.parseWebhookEvent(Buffer.from('not-json', 'utf-8'))).toThrow('not valid JSON')
  })

  it('throws for missing signature_request_id', () => {
    const payload = JSON.stringify({ event: { event_type: 'signature_request_signed' } })
    expect(() => adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))).toThrow('missing signature_request_id')
  })

  it('throws for missing event_type', () => {
    const payload = JSON.stringify({ signature_request: { signature_request_id: 'sr_abc' } })
    expect(() => adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))).toThrow('missing event_type')
  })

  it('throws for unknown event type', () => {
    const payload = JSON.stringify({
      signature_request: { signature_request_id: 'sr_abc' },
      event: { event_type: 'signature_request_unknown_event' },
    })
    expect(() => adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))).toThrow('Unknown Dropbox Sign event type')
  })
})

describe('DropboxSignAdapter - updated mapProviderStatusToPlatform', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  const cases: Array<[string, PlatformSigningStatus]> = [
    ['awaiting_signature', 'sent'],
    ['awaiting_approval', 'sent'],
    ['signed', 'signed'],
    ['declined', 'declined'],
    ['expired', 'expired'],
    ['voided', 'voided'],
    ['errored', 'error'],
    ['sent', 'sent'],
    ['unknown_status', 'draft'],
  ]

  it.each(cases)('maps %s to %s', (providerStatus, expected) => {
    expect(adapter.mapProviderStatusToPlatform(providerStatus)).toBe(expected)
  })
})

describe('DropboxSignAdapter - updated buildLegalDocumentUpdate', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('sets sent_at when platformStatus is sent and occurredAt present', () => {
    const result = {
      envelopeId: 'sr_sent',
      providerName: 'dropbox_sign' as const,
      providerStatus: 'sent',
      platformStatus: 'sent' as const,
      signers: [],
      occurredAt: '2026-06-29T12:00:00.000Z',
    }
    const update = adapter.buildLegalDocumentUpdate(result)
    expect(update.sent_at).toEqual(new Date('2026-06-29T12:00:00.000Z'))
    expect(update.platform_status).toBe('sent')
  })

  it('sets viewed_at when platformStatus is viewed and occurredAt present', () => {
    const result = {
      envelopeId: 'sr_viewed',
      providerName: 'dropbox_sign' as const,
      providerStatus: 'viewed',
      platformStatus: 'viewed' as const,
      signers: [],
      occurredAt: '2026-06-29T13:00:00.000Z',
    }
    const update = adapter.buildLegalDocumentUpdate(result)
    expect(update.viewed_at).toEqual(new Date('2026-06-29T13:00:00.000Z'))
    expect(update.platform_status).toBe('viewed')
  })

  it('sets signed_at when platformStatus is signed and occurredAt present', () => {
    const result = {
      envelopeId: 'sr_signed',
      providerName: 'dropbox_sign' as const,
      providerStatus: 'signed',
      platformStatus: 'signed' as const,
      signers: [],
      occurredAt: '2026-06-29T14:00:00.000Z',
    }
    const update = adapter.buildLegalDocumentUpdate(result)
    expect(update.signed_at).toEqual(new Date('2026-06-29T14:00:00.000Z'))
    expect(update.platform_status).toBe('signed')
  })

  it('sets platform_status sent for create result with status sent', () => {
    const result = {
      envelopeId: 'sr_create',
      providerName: 'dropbox_sign' as const,
      status: 'sent' as const,
      sentAt: '2026-06-29T15:00:00.000Z',
    }
    const update = adapter.buildLegalDocumentUpdate(result)
    expect(update.platform_status).toBe('sent')
    expect(update.sent_at).toEqual(new Date('2026-06-29T15:00:00.000Z'))
  })

  it('sets platform_status draft for pending_send result', () => {
    const result = {
      envelopeId: 'sr_draft',
      providerName: 'dropbox_sign' as const,
      status: 'pending_send' as const,
    }
    const update = adapter.buildLegalDocumentUpdate(result)
    expect(update.platform_status).toBe('draft')
  })
})

describe('DropboxSignAdapter - updated parseCreateResponse with new status', () => {
  let adapter: DropboxSignAdapter

  beforeEach(() => {
    adapter = new DropboxSignAdapter(TEST_API_KEY)
  })

  it('returns sent for awaiting_signature provider status', () => {
    const response = {
      signature_request: {
        signature_request_id: 'sr_abc',
        status: 'awaiting_signature',
        signing_url: 'https://sign.example.com/abc',
      },
    }
    const result = adapter.parseCreateResponse(response)
    expect(result.status).toBe('sent')
  })

  it('returns sent for sent provider status', () => {
    const response = {
      signature_request: {
        signature_request_id: 'sr_def',
        status: 'sent',
      },
    }
    const result = adapter.parseCreateResponse(response)
    expect(result.status).toBe('sent')
  })
})

describe('MockESignProvider - verifyWebhookSignature', () => {
  let adapter: import('@/lib/esign/types').ESignAdapter
  const MockProv = require('@/lib/esign/MockESignProvider').MockESignProvider

  const MOCK_SECRET = 'mock-webhook-secret'

  beforeEach(() => {
    adapter = new MockProv(MOCK_SECRET)
  })

  it('accepts a valid signature', () => {
    const payload = validWebhookPayload('signature_request_signed')
    const signature = computeSignature(payload, MOCK_SECRET)
    expect(adapter.verifyWebhookSignature(Buffer.from(payload, 'utf-8'), signature)).toBe(true)
  })

  it('rejects an invalid signature', () => {
    const payload = validWebhookPayload('signature_request_signed')
    expect(adapter.verifyWebhookSignature(Buffer.from(payload, 'utf-8'), 'bad_signature')).toBe(false)
  })

  it('rejects empty signature header', () => {
    const payload = validWebhookPayload('signature_request_signed')
    expect(adapter.verifyWebhookSignature(Buffer.from(payload, 'utf-8'), '')).toBe(false)
  })
})

describe('MockESignProvider - parseWebhookEvent', () => {
  let adapter: import('@/lib/esign/types').ESignAdapter
  const MockProv = require('@/lib/esign/MockESignProvider').MockESignProvider

  beforeEach(() => {
    adapter = new MockProv()
  })

  it('parses a signed event', () => {
    const payload = validWebhookPayload('signature_request_signed', 'mock_env_123')
    const event = adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))
    expect(event.envelopeId).toBe('mock_env_123')
    expect(event.eventType).toBe('signed')
    expect(event.providerRawEvent).toBe('signature_request_signed')
  })

  it('parses viewed event', () => {
    const payload = validWebhookPayload('signature_request_viewed')
    const event = adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))
    expect(event.eventType).toBe('viewed')
  })

  it('throws for invalid JSON', () => {
    expect(() => adapter.parseWebhookEvent(Buffer.from('bad', 'utf-8'))).toThrow('not valid JSON')
  })

  it('throws for missing event_type', () => {
    const payload = JSON.stringify({ signature_request: { signature_request_id: 'mock_eid' } })
    expect(() => adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))).toThrow('missing event_type')
  })

  it('throws for unknown event type', () => {
    const payload = JSON.stringify({
      signature_request: { signature_request_id: 'mock_eid' },
      event: { event_type: 'unknown_event' },
    })
    expect(() => adapter.parseWebhookEvent(Buffer.from(payload, 'utf-8'))).toThrow('Unknown webhook event type')
  })
})

describe('MockESignProvider - updated mapProviderStatusToPlatform and buildLegalDocumentUpdate', () => {
  let adapter: import('@/lib/esign/types').ESignAdapter
  const MockProv = require('@/lib/esign/MockESignProvider').MockESignProvider

  beforeEach(() => {
    adapter = new MockProv()
  })

  it('maps awaiting_signature to sent', () => {
    expect(adapter.mapProviderStatusToPlatform('awaiting_signature')).toBe('sent')
  })

  it('maps awaiting_approval to sent', () => {
    expect(adapter.mapProviderStatusToPlatform('awaiting_approval')).toBe('sent')
  })

  it('builds update with sent platform from create result', () => {
    const createResult = {
      envelopeId: 'mock_eid',
      providerName: 'mock' as const,
      status: 'sent' as const,
      sentAt: '2026-06-29T10:00:00.000Z',
    }
    const update = adapter.buildLegalDocumentUpdate(createResult)
    expect(update.platform_status).toBe('sent')
    expect(update.sent_at).toEqual(new Date('2026-06-29T10:00:00.000Z'))
  })

  it('builds update with viewed_at from occurredAt', () => {
    const result = {
      envelopeId: 'mock_eid',
      providerName: 'mock' as const,
      providerStatus: 'viewed',
      platformStatus: 'viewed' as const,
      signers: [],
      occurredAt: '2026-06-29T11:00:00.000Z',
    }
    const update = adapter.buildLegalDocumentUpdate(result)
    expect(update.platform_status).toBe('viewed')
    expect(update.viewed_at).toEqual(new Date('2026-06-29T11:00:00.000Z'))
  })
})
