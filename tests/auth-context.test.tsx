/**
 * @jest-environment jsdom
 */

import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext'
import { SessionClient, type MeResponse } from '@/lib/auth/session-client'

const mockUser: MeResponse = {
  id: 'user-1',
  name: 'Jane',
  surname: 'Doe',
  email: 'jane@niticore.com',
  role: 'Super Admin',
  last_login_at: '2026-06-28T00:00:00Z',
  totp_enabled: true,
}

function TestConsumer() {
  const { user, loading, error } = useAuth()
  if (loading) return <div data-testid="auth-state">loading</div>
  if (error) return <div data-testid="auth-state">{error}</div>
  if (!user) return <div data-testid="auth-state">unauthenticated</div>
  return (
    <div data-testid="auth-state">
      <span data-testid="user-name">{user.name}</span>
      <span data-testid="user-role">{user.role}</span>
      <span data-testid="user-email">{user.email}</span>
    </div>
  )
}

function createMockClient(overrides: Partial<SessionClient> = {}): SessionClient {
  return { me: jest.fn(), logout: jest.fn(), ...overrides } as unknown as SessionClient
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('AuthProvider', () => {
  it('shows loading state while fetching user', () => {
    const client = createMockClient()
    jest.spyOn(client, 'me').mockReturnValue(new Promise(() => {}))

    render(
      <AuthProvider sessionClient={client}>
        <TestConsumer />
      </AuthProvider>,
    )

    expect(screen.getByTestId('auth-state').textContent).toBe('loading')
  })

  it('renders authenticated state with user data', async () => {
    const client = createMockClient()
    jest.spyOn(client, 'me').mockResolvedValue(mockUser)

    render(
      <AuthProvider sessionClient={client}>
        <TestConsumer />
      </AuthProvider>,
    )

    await screen.findByText('Jane')
    expect(screen.getByTestId('user-name').textContent).toBe('Jane')
    expect(screen.getByTestId('user-role').textContent).toBe('Super Admin')
    expect(screen.getByTestId('user-email').textContent).toBe('jane@niticore.com')
  })

  it('renders unauthenticated state on 401', async () => {
    const client = createMockClient()
    jest.spyOn(client, 'me').mockRejectedValue({ status: 401, message: 'Unauthorized' })

    render(
      <AuthProvider sessionClient={client}>
        <TestConsumer />
      </AuthProvider>,
    )

    await screen.findByText('unauthenticated')
  })

  it('renders error state on 403', async () => {
    const client = createMockClient()
    jest.spyOn(client, 'me').mockRejectedValue({ status: 403, message: 'Forbidden' })

    render(
      <AuthProvider sessionClient={client}>
        <TestConsumer />
      </AuthProvider>,
    )

    await screen.findByText('Account inactive. Please contact an administrator.')
  })

  it('renders retryable error on 500', async () => {
    const client = createMockClient()
    jest.spyOn(client, 'me').mockRejectedValue({ status: 500, message: 'Internal server error' })

    render(
      <AuthProvider sessionClient={client}>
        <TestConsumer />
      </AuthProvider>,
    )

    await screen.findByText('Internal server error')
  })

  it('shows error on network failure', async () => {
    const client = createMockClient()
    jest.spyOn(client, 'me').mockRejectedValue(new TypeError('Failed to fetch'))

    render(
      <AuthProvider sessionClient={client}>
        <TestConsumer />
      </AuthProvider>,
    )

    await screen.findByText('Failed to fetch')
  })

  it('uses default SessionClient when none provided', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    expect(screen.getByTestId('auth-state').textContent).toBe('loading')
  })
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => render(<TestConsumer />)).toThrow(
      'useAuth must be used within an AuthProvider',
    )
  })
})

describe('signOut', () => {
  it('calls logout during sign-out flow', async () => {
    const client = createMockClient()
    jest.spyOn(client, 'me').mockResolvedValue(mockUser)
    const logoutSpy = jest.spyOn(client, 'logout').mockResolvedValue(undefined)

    let capturedSignOut: (() => Promise<void>) | null = null

    function SignOutConsumer() {
      const { signOut } = useAuth()
      capturedSignOut = signOut
      return <div data-testid="signed-in">Signed in</div>
    }

    render(
      <AuthProvider sessionClient={client}>
        <SignOutConsumer />
      </AuthProvider>,
    )

    await screen.findByTestId('signed-in')

    await act(async () => {
      await capturedSignOut!()
    })

    expect(logoutSpy).toHaveBeenCalled()
  })

  it('redirects to login even if logout request fails', async () => {
    const client = createMockClient()
    jest.spyOn(client, 'me').mockResolvedValue(mockUser)
    jest.spyOn(client, 'logout').mockRejectedValue(new Error('Network error'))

    let capturedSignOut: (() => Promise<void>) | null = null

    function SignOutConsumer() {
      const { signOut } = useAuth()
      capturedSignOut = signOut
      return <div data-testid="signed-in">Signed in</div>
    }

    render(
      <AuthProvider sessionClient={client}>
        <SignOutConsumer />
      </AuthProvider>,
    )

    await screen.findByTestId('signed-in')

    // Should not throw when logout fails
    await act(async () => {
      await capturedSignOut!()
    })
  })
})
