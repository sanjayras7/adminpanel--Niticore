/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdminSetupStep } from '@/lib/wizard/steps/AdminSetupStep'
import { ModuleSelectionStep } from '@/lib/wizard/steps/ModuleSelectionStep'
import { WizardProvider } from '@/lib/wizard/WizardContext'
import { WizardStep, AdminRequestBody, ModuleSelection } from '@/lib/wizard/types'

function Wrapper({ children }: { children: React.ReactNode }) {
  const steps: WizardStep[] = [
    { stepNumber: 3, label: 'Test 3', component: () => null, validate: () => ({}) },
    { stepNumber: 4, label: 'Test 4', component: () => null, validate: () => ({}) },
  ]
  return (
    <WizardProvider steps={steps}>
      {children}
    </WizardProvider>
  )
}

describe('AdminSetupStep (Step 3)', () => {
  it('renders all required fields', () => {
    render(
      <Wrapper>
        <AdminSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByLabelText(/First Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Last Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Job Title/)).toBeInTheDocument()
    expect(screen.getByText(/Send invite now/)).toBeInTheDocument()
    expect(screen.getByText(/Defer until setup complete/)).toBeInTheDocument()
  })

  it('shows required field indicators', () => {
    render(
      <Wrapper>
        <AdminSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    const asterisks = screen.getAllByText('*')
    expect(asterisks.length).toBeGreaterThanOrEqual(3)
  })

  it('pre-fills from existing data', () => {
    const existing: AdminRequestBody = {
      name: 'John',
      surname: 'Doe',
      email: 'john@example.com',
      job_title: 'CEO',
      invite_timing: 'send_now',
    }
    render(
      <Wrapper>
        <AdminSetupStep
          data={existing}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByDisplayValue('John')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('CEO')).toBeInTheDocument()
    expect(screen.getByText('Send invite now')).toBeInTheDocument()
    const sendNowRadio = screen.getByRole('radio', { name: /send invite now/i })
    expect(sendNowRadio).toBeChecked()
  })

  it('defaults to defer invite timing when no data', () => {
    render(
      <Wrapper>
        <AdminSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    const deferRadio = screen.getByRole('radio', { name: /defer until setup complete/i })
    expect(deferRadio).toBeChecked()
  })

  it('calls onUpdate when name changes', () => {
    const onUpdate = jest.fn()
    render(
      <Wrapper>
        <AdminSetupStep
          data={undefined}
          onUpdate={onUpdate}
          errors={{}}
        />
      </Wrapper>
    )
    const input = screen.getByLabelText(/First Name/)
    fireEvent.change(input, { target: { value: 'Jane' } })
    expect(onUpdate).toHaveBeenCalled()
    const calledData = onUpdate.mock.calls[0][0] as AdminRequestBody
    expect(calledData.name).toBe('Jane')
  })

  it('calls onUpdate when invite timing changes', () => {
    const onUpdate = jest.fn()
    render(
      <Wrapper>
        <AdminSetupStep
          data={undefined}
          onUpdate={onUpdate}
          errors={{}}
        />
      </Wrapper>
    )
    fireEvent.click(screen.getByRole('radio', { name: /send invite now/i }))
    expect(onUpdate).toHaveBeenCalled()
    const calledData = onUpdate.mock.calls[0][0] as AdminRequestBody
    expect(calledData.invite_timing).toBe('send_now')
  })

  it('displays field errors', () => {
    render(
      <Wrapper>
        <AdminSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{ name: 'First name is required', email: 'Please enter a valid email address' }}
        />
      </Wrapper>
    )
    expect(screen.getByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
  })

  it('dismisses errors when fields are filled via re-render', () => {
    const { rerender } = render(
      <Wrapper>
        <AdminSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{ name: 'First name is required' }}
        />
      </Wrapper>
    )
    expect(screen.getByText('First name is required')).toBeInTheDocument()
    rerender(
      <Wrapper>
        <AdminSetupStep
          data={{ name: 'John', surname: 'Doe', email: 'john@example.com' }}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.queryByText('First name is required')).not.toBeInTheDocument()
  })

  it('shows empty state when data is undefined', () => {
    render(
      <Wrapper>
        <AdminSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByPlaceholderText('e.g., John')).toHaveValue('')
    expect(screen.getByPlaceholderText('e.g., Doe')).toHaveValue('')
    expect(screen.getByPlaceholderText('e.g., john.doe@example.com')).toHaveValue('')
  })
})

describe('ModuleSelectionStep (Step 4)', () => {
  it('renders all module categories', () => {
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByText('Core Security')).toBeInTheDocument()
    expect(screen.getByText('Customer Management')).toBeInTheDocument()
    expect(screen.getByText('Onboarding & Provisioning')).toBeInTheDocument()
    expect(screen.getByText('Configuration')).toBeInTheDocument()
    expect(screen.getByText('Cross-Cutting')).toBeInTheDocument()
  })

  it('renders all 15 modules', () => {
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByText('Auth + MFA')).toBeInTheDocument()
    expect(screen.getByText('RBAC')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('shows module count', () => {
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByText(/of 15 modules enabled/)).toBeInTheDocument()
  })

  it('shows all modules enabled by default', () => {
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBe(15)
    checkboxes.forEach((cb) => {
      expect(cb).toBeChecked()
    })
  })

  it('pre-fills from existing data', () => {
    const existing: ModuleSelection[] = [
      { moduleId: 'mod-auth-mfa', enabled: true },
      { moduleId: 'mod-rbac', enabled: false },
    ]
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={existing}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    const checkboxes = screen.getAllByRole('checkbox')
    const authMfa = checkboxes.find(cb => cb.closest('label')?.textContent?.includes('Auth + MFA'))
    const rbac = checkboxes.find(cb => cb.closest('label')?.textContent?.includes('RBAC'))
    expect(authMfa).toBeChecked()
    expect(rbac).not.toBeChecked()
  })

  it('calls onUpdate when toggling a module', () => {
    const onUpdate = jest.fn()
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={undefined}
          onUpdate={onUpdate}
          errors={{}}
        />
      </Wrapper>
    )
    const firstCheckbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(firstCheckbox)
    expect(onUpdate).toHaveBeenCalled()
    const calledData = onUpdate.mock.calls[0][0] as ModuleSelection[]
    expect(calledData[0].enabled).toBe(false)
  })

  it('shows error from validation', () => {
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{ modules: 'At least one module must be enabled' }}
        />
      </Wrapper>
    )
    expect(screen.getByText('At least one module must be enabled')).toBeInTheDocument()
  })

  it('shows disabled badge for disabled modules', () => {
    const data: ModuleSelection[] = [
      { moduleId: 'mod-auth-mfa', enabled: false },
    ]
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={data}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })

  it('shows enabled badge for enabled modules', () => {
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    const enabledBadges = screen.getAllByText('Enabled')
    expect(enabledBadges.length).toBe(15)
  })

  it('empty data falls back to plan defaults (all enabled)', () => {
    render(
      <Wrapper>
        <ModuleSelectionStep
          data={[]}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach((cb) => {
      expect(cb).toBeChecked()
    })
  })
})
