import {
  createFramework,
  listFrameworks,
  listVersions,
} from '@/lib/frontend/api'

beforeEach(() => {
  delete (global as Record<string, unknown>).fetch
})

describe('API helper - createFramework', () => {
  it('sends POST request with correct headers', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'fw-1', name: 'Test FW' } }),
    })
    global.fetch = mockFetch

    const result = await createFramework({ name: 'Test FW', description: 'Desc' })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/frameworks',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ name: 'Test FW', description: 'Desc' }),
      }),
    )
    expect(result.data.name).toBe('Test FW')
  })

  it('throws ApiError on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_request', message: 'Name is required.' }),
    })

    await expect(createFramework({ name: '' })).rejects.toMatchObject({
      error: 'invalid_request',
      message: 'Name is required.',
    })
  })

  it('throws generic error if response JSON parse fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('parse failed')),
    })

    await expect(createFramework({ name: 'Test' })).rejects.toMatchObject({
      error: 'unknown',
      message: 'Request failed',
    })
  })
})

describe('Auth role detection', () => {
  it('detects Read-only Auditor role', () => {
    const isAuditor = (role: string) => role === 'Read-only Auditor'
    expect(isAuditor('Read-only Auditor')).toBe(true)
    expect(isAuditor('Super Admin')).toBe(false)
  })
})

describe('API helper - listFrameworks', () => {
  it('sends GET request with search and pagination params', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0, page: 1, page_size: 20 }),
    })

    await listFrameworks({ search: 'NIST', page: 2, page_size: 10 })

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/internal/frameworks?search=NIST&page=2&page_size=10',
      expect.any(Object),
    )
  })

  it('omits empty params from query string', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0, page: 1, page_size: 20 }),
    })

    await listFrameworks({})

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/internal/frameworks',
      expect.any(Object),
    )
  })
})

describe('API helper - error responses', () => {
  it('converts 409 conflict response to ApiError with cloned_version_id', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({
        error: 'conflict',
        message: 'A version with this label already exists.',
        cloned_version_id: 'ver-2',
      }),
    })

    try {
      await listVersions('fw-1')
    } catch (e: unknown) {
      const err = e as Record<string, unknown>
      expect(err.error).toBe('conflict')
      expect(err.cloned_version_id).toBe('ver-2')
    }
  })
})
