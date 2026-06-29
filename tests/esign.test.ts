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
    ['awaiting_signature', 'awaiting_signature'],
    ['awaiting_approval', 'awaiting_signature'],
    ['signed', 'signed'],
    ['declined', 'declined'],
    ['expired', 'expired'],
    ['voided', 'voided'],
    ['errored', 'error'],
    ['sent', 'draft'],
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
    expect(result.platformStatus).toBe('awaiting_signature')
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
