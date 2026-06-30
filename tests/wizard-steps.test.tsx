/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FrameworkSelectionStep } from '@/lib/wizard/steps/FrameworkSelectionStep'
import { IntegrationSetupStep } from '@/lib/wizard/steps/IntegrationSetupStep'
import { WizardProvider } from '@/lib/wizard/WizardContext'
import { WizardStep, FrameworkStepData, IntegrationIntentData } from '@/lib/wizard/types'
import { validateFrameworkSelection, validateIntegrationIntent } from '@/lib/validation/wizard'

function Wrapper({ children }: { children: React.ReactNode }) {
  const steps: WizardStep[] = [
    { stepNumber: 5, label: 'Test', component: () => null, validate: () => ({}) },
    { stepNumber: 6, label: 'Test 6', component: () => null, validate: () => ({}) },
  ]
  return (
    <WizardProvider steps={steps}>
      {children}
    </WizardProvider>
  )
}

describe('FrameworkSelectionStep', () => {
  it('renders the stub banner', () => {
    render(
      <Wrapper>
        <FrameworkSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByText(/Framework library not yet available/)).toBeInTheDocument()
  })

  it('renders all three framework checkboxes', () => {
    render(
      <Wrapper>
        <FrameworkSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByLabelText('SOC 2')).toBeInTheDocument()
    expect(screen.getByLabelText('ISO 27001')).toBeInTheDocument()
    expect(screen.getByLabelText('NIST CSF')).toBeInTheDocument()
  })

  it('shows empty state when no frameworks selected', () => {
    render(
      <Wrapper>
        <FrameworkSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByText('No frameworks selected yet.')).toBeInTheDocument()
  })

  it('pre-fills from existing step data', () => {
    const existingData: FrameworkStepData = {
      organization_id: 'test-org-id',
      framework_selections: [
        {
          framework_name: 'SOC 2',
          framework_version_name: '2023',
          control_ids: ['CC1.1', 'CC1.2'],
          risk_threshold: 'high',
        },
      ],
    }
    render(
      <Wrapper>
        <FrameworkSelectionStep
          data={existingData}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByLabelText('SOC 2')).toBeChecked()
    expect(screen.getByText(/2 of 33 controls/)).toBeInTheDocument()
    expect(screen.getByLabelText('Risk threshold for SOC 2')).toHaveValue('high')
  })

  it('calls onUpdate when toggling a framework', () => {
    const onUpdate = jest.fn()
    render(
      <Wrapper>
        <FrameworkSelectionStep
          data={undefined}
          onUpdate={onUpdate}
          errors={{}}
        />
      </Wrapper>
    )
    fireEvent.click(screen.getByLabelText('SOC 2'))
    expect(onUpdate).toHaveBeenCalled()
    const calledData = onUpdate.mock.calls[0][0] as FrameworkStepData
    expect(calledData.framework_selections).toHaveLength(1)
    expect(calledData.framework_selections[0].framework_name).toBe('SOC 2')
  })

  it('removes framework when unchecked', () => {
    const onUpdate = jest.fn()
    const existingData: FrameworkStepData = {
      organization_id: 'test-org-id',
      framework_selections: [
        {
          framework_name: 'SOC 2',
          framework_version_name: '2023',
          control_ids: ['CC1.1'],
          risk_threshold: 'medium',
        },
      ],
    }
    render(
      <Wrapper>
        <FrameworkSelectionStep
          data={existingData}
          onUpdate={onUpdate}
          errors={{}}
        />
      </Wrapper>
    )
    fireEvent.click(screen.getByLabelText('SOC 2'))
    expect(onUpdate).toHaveBeenCalled()
    const calledData = onUpdate.mock.calls[0][0] as FrameworkStepData
    expect(calledData.framework_selections).toHaveLength(0)
  })

  it('displays error from validation', () => {
    render(
      <Wrapper>
        <FrameworkSelectionStep
          data={undefined}
          onUpdate={() => {}}
          errors={{ framework_selections: 'Framework selections must be an array' }}
        />
      </Wrapper>
    )
    expect(screen.getByText('Framework selections must be an array')).toBeInTheDocument()
  })

  describe('validateFrameworkSelection integration', () => {
    it('validates empty organization_id', () => {
      const errors = validateFrameworkSelection({ organization_id: '', framework_selections: [] })
      expect(errors.organization_id).toBeDefined()
    })

    it('validates non-array framework_selections', () => {
      const errors = validateFrameworkSelection({
        organization_id: '00000000-0000-0000-0000-000000000000',
        framework_selections: 'bad' as any,
      })
      expect(errors.framework_selections).toBeDefined()
    })

    it('accepts valid framework data', () => {
      const errors = validateFrameworkSelection({
        organization_id: '00000000-0000-0000-0000-000000000000',
        framework_selections: [{ framework_name: 'SOC 2', risk_threshold: 'medium' }],
      })
      expect(Object.keys(errors)).toHaveLength(0)
    })
  })
})

describe('IntegrationSetupStep', () => {
  it('renders domain input', () => {
    render(
      <Wrapper>
        <IntegrationSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByLabelText('Domain')).toBeInTheDocument()
  })

  it('renders SSO checkbox', () => {
    render(
      <Wrapper>
        <IntegrationSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByLabelText('SSO Required')).toBeInTheDocument()
  })

  it('shows SSO provider field when SSO is checked', () => {
    render(
      <Wrapper>
        <IntegrationSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    fireEvent.click(screen.getByLabelText('SSO Required'))
    expect(screen.getByLabelText('SSO Provider')).toBeInTheDocument()
  })

  it('hides SSO provider field when SSO is unchecked', () => {
    render(
      <Wrapper>
        <IntegrationSetupStep
          data={{ organization_id: 'test-id', sso_required: true, sso_provider: 'Okta' }}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByLabelText('SSO Provider')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('SSO Required'))
    expect(screen.queryByLabelText('SSO Provider')).not.toBeInTheDocument()
  })

  it('pre-fills from existing data', () => {
    const data: IntegrationIntentData = {
      organization_id: 'test-org-id',
      domain: 'example.com',
      sso_required: true,
      sso_provider: 'Okta',
      notes: 'Use existing Okta tenant',
    }
    render(
      <Wrapper>
        <IntegrationSetupStep
          data={data}
          onUpdate={() => {}}
          errors={{}}
        />
      </Wrapper>
    )
    expect(screen.getByDisplayValue('example.com')).toBeInTheDocument()
    expect(screen.getByLabelText('SSO Required')).toBeChecked()
    expect(screen.getByDisplayValue('Okta')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Use existing Okta tenant')).toBeInTheDocument()
  })

  it('calls onUpdate when domain changes', () => {
    const onUpdate = jest.fn()
    render(
      <Wrapper>
        <IntegrationSetupStep
          data={undefined}
          onUpdate={onUpdate}
          errors={{}}
        />
      </Wrapper>
    )
    const input = screen.getByLabelText('Domain')
    fireEvent.change(input, { target: { value: 'test.example.com' } })
    expect(onUpdate).toHaveBeenCalled()
    const calledData = onUpdate.mock.calls[0][0] as IntegrationIntentData
    expect(calledData.domain).toBe('test.example.com')
  })

  it('shows error from validation', () => {
    render(
      <Wrapper>
        <IntegrationSetupStep
          data={undefined}
          onUpdate={() => {}}
          errors={{ domain: 'Domain must be 255 characters or less' }}
        />
      </Wrapper>
    )
    expect(screen.getByText('Domain must be 255 characters or less')).toBeInTheDocument()
  })

  describe('validateIntegrationIntent integration', () => {
    it('validates missing organization_id', () => {
      const errors = validateIntegrationIntent({ organization_id: '' })
      expect(errors.organization_id).toBeDefined()
    })

    it('validates oversized domain', () => {
      const errors = validateIntegrationIntent({
        organization_id: '00000000-0000-0000-0000-000000000000',
        domain: 'a'.repeat(256),
      })
      expect(errors.domain).toBeDefined()
    })

    it('accepts valid integration intent', () => {
      const errors = validateIntegrationIntent({
        organization_id: '00000000-0000-0000-0000-000000000000',
        domain: 'example.com',
        sso_required: true,
        sso_provider: 'Okta',
        notes: 'Test notes',
      })
      expect(Object.keys(errors)).toHaveLength(0)
    })
  })
})
