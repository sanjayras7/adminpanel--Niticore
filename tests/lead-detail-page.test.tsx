/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockReplace = jest.fn()

let LeadDetailPage: typeof import('@/app/(internal)/leads/[id]/page').default

beforeAll(async () => {
  LeadDetailPage = (await import('@/app/(internal)/leads/[id]/page')).default
})

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'lead-1' }),
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => '/internal/leads/lead-1',
}))

jest.mock('@/lib/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Jane',
      surname: 'Doe',
      email: 'jane@niticore.com',
      role: 'Super Admin',
      last_login_at: '2026-06-28T00:00:00Z',
      totp_enabled: true,
    },
    loading: false,
    error: null,
    signOut: jest.fn(),
  }),
}))

const mockLead = {
  id: 'lead-1',
  company_name: 'Acme Corp',
  contact_first_name: 'John',
  contact_last_name: 'Smith',
  work_email: 'john@acme.com',
  phone: '+1-555-0100',
  company_domain: 'acme.com',
  company_website: 'https://acme.com',
  country: 'US',
  region: 'North America',
  company_size: '51-200',
  interested_modules_json: ['GRC', 'Audit'],
  interested_frameworks_json: ['SOC 2', 'ISO 27001'],
  message: 'Interested in demo',
  source: 'Website Form',
  status: 'New',
  assigned_owner_id: 'owner-1',
  nda_required: true,
  demo_status: 'Scheduled',
  contract_status: null,
  created_at: '2026-06-25T10:00:00Z',
}

const mockNotes = [
  {
    id: 'note-1',
    lead_id: 'lead-1',
    note_text: 'Initial contact made',
    created_by: 'user-1',
    updated_by: null,
    created_at: '2026-06-26T10:00:00Z',
    updated_at: '2026-06-26T10:00:00Z',
  },
  {
    id: 'note-2',
    lead_id: 'lead-1',
    note_text: 'Follow-up scheduled',
    created_by: 'user-1',
    updated_by: 'user-1',
    created_at: '2026-06-27T10:00:00Z',
    updated_at: '2026-06-27T12:00:00Z',
  },
]

const mockTimeline = [
  {
    id: 'event-1',
    actor: { id: 'user-1', role: 'Super Admin' },
    action: 'lead_created',
    description: 'user-1 (Super Admin) created lead lead-1 (Acme Corp)',
    target: { type: 'lead', id: 'lead-1' },
    organizationId: null,
    leadId: 'lead-1',
    createdAt: '2026-06-25T10:00:00Z',
  },
]

function createFetchMock(
  responseMap: Record<string, unknown>,
  statusMap?: Record<string, number>,
) {
  const mockFn = jest.fn().mockImplementation((url: string) => {
    const key = url.split('?')[0]
    const response = responseMap[key] ?? responseMap[url]
    const status = statusMap?.[key] ?? statusMap?.[url] ?? 200

    if (response === undefined) {
      return Promise.reject(new Error(`Network error for ${url}`))
    }

    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
    })
  })
  global.fetch = mockFn
  return mockFn
}

function mockNetworkError() {
  global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('LeadDetailPage', () => {
  it('shows loading state while fetching', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {}))

    const { container } = render(<LeadDetailPage />)

    const spinner = container.querySelector('[style*="animation"]')
    expect(spinner).toBeTruthy()
  })

  it('renders lead details when data loads successfully', async () => {
    createFetchMock({
      '/api/v1/internal/leads/lead-1': mockLead,
      '/api/v1/internal/leads/lead-1/notes': mockNotes,
      '/api/v1/audit/timeline': { events: mockTimeline, nextCursor: null },
    })

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(2)
    })

    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('john@acme.com')).toBeTruthy()
    expect(screen.getByText('+1-555-0100')).toBeTruthy()
    expect(screen.getByText('GRC')).toBeTruthy()
    expect(screen.getByText('SOC 2')).toBeTruthy()
    expect(screen.getByText('New')).toBeTruthy()
    expect(screen.getByText('Yes')).toBeTruthy()
    expect(screen.getByText('Scheduled')).toBeTruthy()

    expect(screen.getByText('Initial contact made')).toBeTruthy()
    expect(screen.getByText('Follow-up scheduled')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('user-1 (Super Admin) created lead lead-1 (Acme Corp)')).toBeTruthy()
    })
  })

  it('renders permission error on 403', async () => {
    createFetchMock(
      {
        '/api/v1/internal/leads/lead-1': { error: 'forbidden' },
        '/api/v1/internal/leads/lead-1/notes': [],
        '/api/v1/audit/timeline': { events: [], nextCursor: null },
      },
      { '/api/v1/internal/leads/lead-1': 403 },
    )

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('You do not have permission to view this lead.')).toBeTruthy()
    })
  })

  it('renders 404 error when lead not found', async () => {
    createFetchMock(
      {
        '/api/v1/internal/leads/lead-1': { error: 'not_found' },
        '/api/v1/internal/leads/lead-1/notes': [],
        '/api/v1/audit/timeline': { events: [], nextCursor: null },
      },
      { '/api/v1/internal/leads/lead-1': 404 },
    )

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Lead not found.')).toBeTruthy()
    })
  })

  it('renders network error on fetch failure', async () => {
    mockNetworkError()

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Network error. Please check your connection and try again.')).toBeTruthy()
    })
  })

  it('shows retry button on error', async () => {
    mockNetworkError()

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeTruthy()
    })
  })

  it('shows back to leads link on error', async () => {
    mockNetworkError()

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Back to leads')).toBeTruthy()
    })
  })

  it('shows empty notes state', async () => {
    createFetchMock({
      '/api/v1/internal/leads/lead-1': mockLead,
      '/api/v1/internal/leads/lead-1/notes': [],
      '/api/v1/audit/timeline': { events: [], nextCursor: null },
    })

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('No notes yet.')).toBeTruthy()
    })
  })

  it('shows empty timeline state', async () => {
    createFetchMock({
      '/api/v1/internal/leads/lead-1': mockLead,
      '/api/v1/internal/leads/lead-1/notes': mockNotes,
      '/api/v1/audit/timeline': { events: [], nextCursor: null },
    })

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('No activity yet.')).toBeTruthy()
    })
  })

  it('shows timeline error state gracefully', async () => {
    createFetchMock(
      {
        '/api/v1/internal/leads/lead-1': mockLead,
        '/api/v1/internal/leads/lead-1/notes': mockNotes,
        '/api/v1/audit/timeline': { error: 'server_error' },
      },
      {
        '/api/v1/audit/timeline': 500,
      },
    )

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Could not load activity timeline.')).toBeTruthy()
    })
  })

  it('creates a note', async () => {
    const fetchMock = createFetchMock({
      '/api/v1/internal/leads/lead-1': mockLead,
      '/api/v1/internal/leads/lead-1/notes': [],
      '/api/v1/audit/timeline': { events: [], nextCursor: null },
    })

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('No notes yet.')).toBeTruthy()
    })

    const newNote = { id: 'note-new', lead_id: 'lead-1', note_text: 'New test note', created_by: 'user-1', updated_by: null, created_at: '2026-06-28T10:00:00Z', updated_at: '2026-06-28T10:00:00Z' }

    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/v1/internal/leads/lead-1/notes' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(newNote),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })
    })

    const textarea = screen.getByPlaceholderText('Add a note...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'New test note' } })

    const addButton = screen.getByText('Add Note')
    await act(async () => {
      addButton.click()
    })

    await waitFor(() => {
      expect(screen.getByText('New test note')).toBeTruthy()
    })
  })

  it('edits a note', async () => {
    const fetchMock = createFetchMock({
      '/api/v1/internal/leads/lead-1': mockLead,
      '/api/v1/internal/leads/lead-1/notes': mockNotes,
      '/api/v1/audit/timeline': { events: [], nextCursor: null },
    })

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Edit').length).toBeGreaterThan(0)
    })

    const editButtons = screen.getAllByText('Edit')
    await act(async () => {
      editButtons[0].click()
    })

    const updatedNote = { ...mockNotes[0], note_text: 'Updated text', updated_by: 'user-1', updated_at: '2026-06-28T10:00:00Z' }

    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/v1/internal/leads/lead-1/notes/note-1' && opts?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(updatedNote),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockLead),
      })
    })

    const textarea = screen.getByDisplayValue('Initial contact made') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Updated text' } })

    const saveButton = screen.getByText('Save')
    await act(async () => {
      saveButton.click()
    })

    await waitFor(() => {
      expect(screen.getByText('Updated text')).toBeTruthy()
    })
  })

  it('deletes a note', async () => {
    const fetchMock = createFetchMock({
      '/api/v1/internal/leads/lead-1': mockLead,
      '/api/v1/internal/leads/lead-1/notes': mockNotes,
      '/api/v1/audit/timeline': { events: [], nextCursor: null },
    })

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Delete').length).toBeGreaterThan(0)
    })

    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/v1/internal/leads/lead-1/notes/note-1' && opts?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'Note deleted' }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockLead),
      })
    })

    const deleteButtons = screen.getAllByText('Delete')
    await act(async () => {
      deleteButtons[0].click()
    })

    await waitFor(() => {
      expect(screen.queryByText('Initial contact made')).toBeNull()
    })
  })

  it('shows back to leads link in header', async () => {
    createFetchMock({
      '/api/v1/internal/leads/lead-1': mockLead,
      '/api/v1/internal/leads/lead-1/notes': mockNotes,
      '/api/v1/audit/timeline': { events: [], nextCursor: null },
    })

    render(<LeadDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('← Back to leads')).toBeTruthy()
    })
  })
})
