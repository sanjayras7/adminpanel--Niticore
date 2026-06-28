/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react'
import { SessionClient, type MeResponse } from '@/lib/auth/session-client'

const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const mockUser: MeResponse = {
  id: 'user-1',
  name: 'Jane',
  surname: 'Doe',
  email: 'jane@niticore.com',
  role: 'Super Admin',
  last_login_at: '2026-06-28T00:00:00Z',
  totp_enabled: true,
}

let InternalLayout: typeof import('@/app/(internal)/layout').default

beforeAll(async () => {
  InternalLayout = (await import('@/app/(internal)/layout')).default
})

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockReplace.mockClear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('InternalLayout shell', () => {
  it('renders loading state while session resolves', () => {
    jest.spyOn(SessionClient.prototype, 'me').mockReturnValue(new Promise(() => {}))

    const { container } = render(
      <InternalLayout>
        <div>Content</div>
      </InternalLayout>,
    )

    const spinner = container.querySelector('[style*="animation"]')
    expect(spinner).toBeTruthy()
  })

  it('renders content when session resolves', async () => {
    jest.spyOn(SessionClient.prototype, 'me').mockResolvedValue(mockUser)

    render(
      <InternalLayout>
        <div data-testid="content">Dashboard content</div>
      </InternalLayout>,
    )

    await screen.findByTestId('content')
    expect(screen.getByTestId('content').textContent).toBe('Dashboard content')
  })

  it('renders the internal environment badge when authenticated', async () => {
    jest.spyOn(SessionClient.prototype, 'me').mockResolvedValue(mockUser)

    render(
      <InternalLayout>
        <div>Content</div>
      </InternalLayout>,
    )

    const badge = await screen.findByText('Internal — Super Admin Panel')
    expect(badge).toBeTruthy()
  })

  it('renders user name and role in header when authenticated', async () => {
    jest.spyOn(SessionClient.prototype, 'me').mockResolvedValue(mockUser)

    render(
      <InternalLayout>
        <div>Content</div>
      </InternalLayout>,
    )

    const userName = await screen.findByText('Jane Doe')
    expect(userName).toBeTruthy()
  })

  it('shows error state for inactive user (403)', async () => {
    jest.spyOn(SessionClient.prototype, 'me').mockRejectedValue({ status: 403 })

    render(
      <InternalLayout>
        <div>Content</div>
      </InternalLayout>,
    )

    const errorText = await screen.findByText('Account inactive. Please contact an administrator.')
    expect(errorText).toBeTruthy()

    const retryButton = await screen.findByText('Try again')
    expect(retryButton).toBeTruthy()
  })

  it('shows retryable error on server error (500)', async () => {
    jest.spyOn(SessionClient.prototype, 'me').mockRejectedValue({
      status: 500,
      message: 'Internal server error',
    })

    render(
      <InternalLayout>
        <div>Content</div>
      </InternalLayout>,
    )

    const errorText = await screen.findByText('Internal server error')
    expect(errorText).toBeTruthy()

    const retryButton = await screen.findByText('Try again')
    expect(retryButton).toBeTruthy()
  })
})
