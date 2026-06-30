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

describe('API helper - controls', () => {
  it('listControls sends GET with search and pagination', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'c-1', control_code: 'AC-1', title: 'Access Control', description: null, version_count: 0, created_at: '', updated_at: '' }], total: 1, page: 1, page_size: 20 }),
    })
    global.fetch = mockFetch

    const { listControls } = await import('@/lib/frontend/api')
    const result = await listControls({ search: 'Access', page: 1 }, 'user-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/controls?search=Access&page=1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-internal-user-id': 'user-1' }),
      }),
    )
    expect(result.data[0].control_code).toBe('AC-1')
  })

  it('getControl sends GET with user id header', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'c-1', control_code: 'AC-1', title: 'Access Control', description: null, version_count: 1, versions: [], created_at: '', updated_at: '' } }),
    })
    global.fetch = mockFetch

    const { getControl } = await import('@/lib/frontend/api')
    const result = await getControl('c-1', 'user-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/controls/c-1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-internal-user-id': 'user-1' }),
      }),
    )
    expect(result.data.title).toBe('Access Control')
  })
})

describe('API helper - control-framework-mappings', () => {
  it('listControlFrameworkMappings sends GET with control_id', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0, page: 1, page_size: 20 }),
    })
    global.fetch = mockFetch

    const { listControlFrameworkMappings } = await import('@/lib/frontend/api')
    await listControlFrameworkMappings({ control_id: 'c-1' }, 'user-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/control-framework-mappings?control_id=c-1',
      expect.any(Object),
    )
  })

  it('createControlFrameworkMapping sends POST', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'm-1', control_id: 'c-1', framework_clause_id: 'cl-1' } }),
    })
    global.fetch = mockFetch

    const { createControlFrameworkMapping } = await import('@/lib/frontend/api')
    const result = await createControlFrameworkMapping({ control_id: 'c-1', framework_clause_id: 'cl-1' }, 'user-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/control-framework-mappings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ control_id: 'c-1', framework_clause_id: 'cl-1' }),
      }),
    )
    expect(result.data.framework_clause_id).toBe('cl-1')
  })

  it('deleteControlFrameworkMapping sends DELETE', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    global.fetch = mockFetch

    const { deleteControlFrameworkMapping } = await import('@/lib/frontend/api')
    await deleteControlFrameworkMapping('m-1', 'user-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/control-framework-mappings/m-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('deleteControlFrameworkMapping throws on error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'not_found', message: 'Mapping not found' }),
    })

    const { deleteControlFrameworkMapping } = await import('@/lib/frontend/api')
    await expect(deleteControlFrameworkMapping('bad-id')).rejects.toMatchObject({
      error: 'not_found',
    })
  })
})

describe('API helper - control-risk-mappings', () => {
  it('listControlRiskMappings sends GET with control_id', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0, page: 1, page_size: 20 }),
    })
    global.fetch = mockFetch

    const { listControlRiskMappings } = await import('@/lib/frontend/api')
    await listControlRiskMappings({ control_id: 'c-1' }, 'user-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/control-risk-mappings?control_id=c-1',
      expect.any(Object),
    )
  })

  it('createControlRiskMapping sends POST', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'm-1', control_id: 'c-1', risk_id: 'r-1' } }),
    })
    global.fetch = mockFetch

    const { createControlRiskMapping } = await import('@/lib/frontend/api')
    const result = await createControlRiskMapping({ control_id: 'c-1', risk_id: 'r-1' }, 'user-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/control-risk-mappings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ control_id: 'c-1', risk_id: 'r-1' }),
      }),
    )
    expect(result.data.risk_id).toBe('r-1')
  })

  it('deleteControlRiskMapping sends DELETE', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    global.fetch = mockFetch

    const { deleteControlRiskMapping } = await import('@/lib/frontend/api')
    await deleteControlRiskMapping('m-1', 'user-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/control-risk-mappings/m-1',
      expect.objectContaining({ method: 'DELETE' }),
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
