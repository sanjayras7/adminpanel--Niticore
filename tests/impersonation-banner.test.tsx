/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'

function createFetchMock(responses: Record<string, unknown>) {
  return jest.fn().mockImplementation((url: string) => {
    const body = responses[url]
    if (body === undefined) {
      return Promise.reject(new Error('Network error'))
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    })
  })
}

function createErrorFetchMock(status = 500, body = { error: 'error', message: 'Server error' }) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('ImpersonationBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('renders nothing while loading', () => {
    global.fetch = jest.fn(() => new Promise(() => {}))
    const { container } = render(<ImpersonationBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when no active session', async () => {
    global.fetch = createFetchMock({
      '/api/v1/internal/impersonation/session-check': { active: false },
    })

    const { container } = render(<ImpersonationBanner />)
    await act(async () => {})
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing on API error', async () => {
    global.fetch = createErrorFetchMock()

    const { container } = render(<ImpersonationBanner />)
    await act(async () => {})
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const { container } = render(<ImpersonationBanner />)
    await act(async () => {})
    expect(container.innerHTML).toBe('')
  })

  it('renders banner when session is active', async () => {
    global.fetch = createFetchMock({
      '/api/v1/internal/impersonation/session-check': {
        active: true,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        organization_id: 'org-12345-abcde',
        impersonated_user_id: 'user-67890',
      },
    })

    render(<ImpersonationBanner />)
    await act(async () => {})

    expect(screen.getByTestId('impersonation-banner')).toBeTruthy()
    expect(screen.getByText('Impersonating')).toBeTruthy()
    expect(screen.getByText('Read Only')).toBeTruthy()
    expect(screen.getByTestId('end-impersonation-button')).toBeTruthy()
  })

  it('shows elapsed time', async () => {
    global.fetch = createFetchMock({
      '/api/v1/internal/impersonation/session-check': {
        active: true,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    })

    render(<ImpersonationBanner />)
    await act(async () => {})

    expect(screen.getByText(/0s/)).toBeTruthy()

    act(() => { jest.advanceTimersByTime(3000) })

    expect(screen.getByText(/3s/)).toBeTruthy()
  })

  it('ends impersonation on button click and hides banner', async () => {
    const endMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ended', ended_at: new Date().toISOString() }),
    })

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/internal/impersonation/end') {
        return endMock()
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ active: true }),
      })
    })

    render(<ImpersonationBanner />)
    await act(async () => {})

    expect(screen.getByTestId('impersonation-banner')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByTestId('end-impersonation-button'))
    })

    expect(endMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('impersonation-banner')).toBeNull()
  })

  it('disables button while ending', async () => {
    let resolveEnd: (value: unknown) => void
    const endPromise = new Promise((resolve) => { resolveEnd = resolve })

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/internal/impersonation/end') {
        return endPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve({ status: 'ended' }),
        }))
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ active: true }),
      })
    })

    render(<ImpersonationBanner />)
    await act(async () => {})

    const button = screen.getByTestId('end-impersonation-button') as HTMLButtonElement

    fireEvent.click(button)
    expect(button.disabled).toBe(true)
    expect(screen.getByText(/Ending/)).toBeTruthy()

    await act(async () => { resolveEnd!(undefined) })
  })

  it('banner has role="alert"', async () => {
    global.fetch = createFetchMock({
      '/api/v1/internal/impersonation/session-check': { active: true },
    })

    render(<ImpersonationBanner />)
    await act(async () => {})

    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
