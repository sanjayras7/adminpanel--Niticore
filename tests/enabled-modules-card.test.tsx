/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen, fireEvent, act } from '@testing-library/react'
import EnabledModulesCard from '@/components/tenants/EnabledModulesCard'
import type { TenantModule } from '@/lib/frontend/api'

const mockModules: TenantModule[] = [
  {
    moduleId: 'm1',
    moduleName: 'Auth + MFA',
    subModules: [
      { id: 'sm1', name: 'Login', enabled: true, configId: 'cfg-1' },
      { id: 'sm2', name: 'MFA', enabled: false, configId: 'cfg-2' },
    ],
  },
  {
    moduleId: 'm2',
    moduleName: 'Reporting',
    subModules: [
      { id: 'sm3', name: 'Dashboards', enabled: true, configId: 'cfg-3' },
      { id: 'sm4', name: 'Unconfigured Sub', enabled: false, configId: null },
    ],
  },
]

const defaultProps = {
  organizationId: 'org-1',
  modules: mockModules,
  canToggle: true,
  userId: 'user-1',
}

beforeEach(() => {
  delete (global as Record<string, unknown>).fetch
})

describe('EnabledModulesCard', () => {
  it('renders modules and sub-modules', () => {
    render(<EnabledModulesCard {...defaultProps} />)

    expect(screen.getByText('Auth + MFA')).toBeTruthy()
    expect(screen.getByText('Reporting')).toBeTruthy()
    expect(screen.getByText('Login')).toBeTruthy()
    expect(screen.getByText('MFA')).toBeTruthy()
    expect(screen.getByText('Dashboards')).toBeTruthy()
  })

  it('shows empty state when no modules', () => {
    render(<EnabledModulesCard {...defaultProps} modules={[]} />)

    expect(screen.getByText('No modules configured')).toBeTruthy()
  })

  it('shows error state from initial error prop', () => {
    render(<EnabledModulesCard {...defaultProps} error="Failed to load modules" />)

    expect(screen.getByText('Failed to load modules')).toBeTruthy()
  })

  it('shows read-only label when canToggle is false', () => {
    render(<EnabledModulesCard {...defaultProps} canToggle={false} />)

    expect(screen.getByText('Read-only')).toBeTruthy()
  })

  it('disables switches when canToggle is false', () => {
    render(<EnabledModulesCard {...defaultProps} canToggle={false} />)

    const switches = screen.getAllByRole('switch')
    switches.forEach((sw) => {
      expect(sw).toBeDisabled()
    })
  })

  it('enables switches when canToggle is true', () => {
    render(<EnabledModulesCard {...defaultProps} />)

    const switches = screen.getAllByRole('switch')
    switches.forEach((sw) => {
      expect(sw).not.toBeDisabled()
    })
  })

  it('shows "Not configured" for sub-modules without configId', () => {
    render(<EnabledModulesCard {...defaultProps} />)

    const notConfiguredLabels = screen.getAllByText('Not configured')
    expect(notConfiguredLabels.length).toBe(1)
  })

  it('toggles sub-module on switch click and calls API', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'cfg-2', enabled: true } }),
    })
    global.fetch = mockFetch

    render(<EnabledModulesCard {...defaultProps} />)

    const switches = screen.getAllByRole('switch')
    const mfaSwitch = switches[1] // MFA is index 1 (enabled: false)

    await act(async () => {
      fireEvent.click(mfaSwitch)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/tenants/org-1/modules/cfg-2',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled: true }),
      }),
    )
  })

  it('reverts toggle on API failure', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'))
    global.fetch = mockFetch

    render(<EnabledModulesCard {...defaultProps} />)

    const switches = screen.getAllByRole('switch')
    const mfaSwitch = switches[1] // MFA initially disabled

    await act(async () => {
      fireEvent.click(mfaSwitch)
    })

    expect(screen.getByText('Failed to update module. Please try again.')).toBeTruthy()

    const switchesAfter = screen.getAllByRole('switch')
    expect(switchesAfter[1].getAttribute('aria-checked')).toBe('false')
  })

  it('toggles sub-module off (disable)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'cfg-1', enabled: false } }),
    })
    global.fetch = mockFetch

    render(<EnabledModulesCard {...defaultProps} />)

    const switches = screen.getAllByRole('switch')
    const loginSwitch = switches[0] // Login initially enabled

    await act(async () => {
      fireEvent.click(loginSwitch)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/internal/tenants/org-1/modules/cfg-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ enabled: false }),
      }),
    )
  })
})
