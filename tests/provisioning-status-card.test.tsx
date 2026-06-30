/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import ProvisioningStatusCard from '@/components/tenants/ProvisioningStatusCard'
import type { ProvisioningStatus } from '@/lib/queries/tenant'

const baseLog = {
  id: 'log-1',
  organization_id: 'org-1',
  tenant_hash: 'abc123hash',
  template_version_id: 'tmpl-ver-1',
  status: 'success' as const,
  failed_table: null,
  error_message: null,
  started_at: '2026-06-01T00:00:00.000Z',
  completed_at: '2026-06-01T01:00:00.000Z',
  created_at: '2026-06-01T00:00:00.000Z',
}

const mockDetails = [
  {
    id: 'det-1',
    provisioning_log_id: 'log-1',
    schema_name: 'tenant_abc',
    table_name: 'users',
    status: 'created' as const,
    error_message: null,
    rows_created: 10,
    started_at: '2026-06-01T00:00:00.000Z',
    completed_at: '2026-06-01T00:30:00.000Z',
  },
  {
    id: 'det-2',
    provisioning_log_id: 'log-1',
    schema_name: 'tenant_abc',
    table_name: 'roles',
    status: 'created' as const,
    error_message: null,
    rows_created: 5,
    started_at: '2026-06-01T00:30:00.000Z',
    completed_at: '2026-06-01T01:00:00.000Z',
  },
]

describe('ProvisioningStatusCard', () => {
  it('renders success status badge', () => {
    render(<ProvisioningStatusCard provisioning={{ log: baseLog, details: mockDetails }} />)
    expect(screen.getByText('Success')).toBeTruthy()
  })

  it('renders failed status badge', () => {
    const failedLog = { ...baseLog, status: 'failed' as const, failed_table: 'users', error_message: 'Column already exists' }
    render(<ProvisioningStatusCard provisioning={{ log: failedLog, details: [] }} />)
    expect(screen.getByText('Failed')).toBeTruthy()
  })

  it('renders in_progress status badge', () => {
    const inProgressLog = { ...baseLog, status: 'in_progress' as const, completed_at: null }
    render(<ProvisioningStatusCard provisioning={{ log: inProgressLog, details: [] }} />)
    expect(screen.getByText('In Progress')).toBeTruthy()
  })

  it('renders summary card fields', () => {
    render(<ProvisioningStatusCard provisioning={{ log: baseLog, details: mockDetails }} />)
    expect(screen.getByText('abc123hash')).toBeTruthy()
    expect(screen.getByText('tmpl-ver-1')).toBeTruthy()
  })

  it('renders failed indicator with table name and error message', () => {
    const failedLog = { ...baseLog, status: 'failed' as const, failed_table: 'users', error_message: 'Column "email" already exists' }
    render(<ProvisioningStatusCard provisioning={{ log: failedLog, details: [] }} />)
    expect(screen.getByText(/users/)).toBeTruthy()
    expect(screen.getByText('Column "email" already exists')).toBeTruthy()
  })

  it('shows empty state when log is null', () => {
    render(<ProvisioningStatusCard provisioning={{ log: null, details: [] }} />)
    expect(screen.getByText('Not yet provisioned')).toBeTruthy()
  })

  it('shows error state from error prop', () => {
    render(<ProvisioningStatusCard provisioning={{ log: baseLog, details: [] }} error="Failed to load provisioning data" />)
    expect(screen.getByText('Failed to load provisioning data')).toBeTruthy()
  })

  it('shows expandable per-table detail section', () => {
    render(<ProvisioningStatusCard provisioning={{ log: baseLog, details: mockDetails }} />)
    expect(screen.getByText(/Per-Table Details/)).toBeTruthy()
  })

  it('toggles detail table on click', () => {
    render(<ProvisioningStatusCard provisioning={{ log: baseLog, details: mockDetails }} />)
    const toggle = screen.getByText(/Per-Table Details/)
    expect(screen.queryByText('users')).toBeNull()
    fireEvent.click(toggle)
    expect(screen.getByText('users')).toBeTruthy()
    expect(screen.getByText('roles')).toBeTruthy()
    fireEvent.click(toggle)
    expect(screen.queryByText('users')).toBeNull()
  })

  it('shows detail row values when expanded', () => {
    render(<ProvisioningStatusCard provisioning={{ log: baseLog, details: mockDetails }} />)
    fireEvent.click(screen.getByText(/Per-Table Details/))
    expect(screen.getAllByText('tenant_abc')).toHaveLength(2)
    expect(screen.getByText('users')).toBeTruthy()
    expect(screen.getByText('roles')).toBeTruthy()
    expect(screen.getAllByText('Created')).toHaveLength(2)
    expect(screen.getByText('10')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('shows "No detail records" when details empty and status not failed', () => {
    const succeededLog = { ...baseLog, status: 'success' as const }
    render(<ProvisioningStatusCard provisioning={{ log: succeededLog, details: [] }} />)
    expect(screen.getByText('No detail records')).toBeTruthy()
  })

  it('renders completed_at as dash when null', () => {
    const inProgressLog = { ...baseLog, status: 'in_progress' as const, completed_at: null }
    render(<ProvisioningStatusCard provisioning={{ log: inProgressLog, details: [] }} />)
    const dashElements = screen.getAllByText('—')
    expect(dashElements.length).toBeGreaterThanOrEqual(1)
  })
})
