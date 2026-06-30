'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { WizardProvider, useWizard, WizardStep } from '@/lib/wizard/WizardContext'
import { WizardShell } from '@/lib/wizard/WizardShell'
import { CustomerProfileStep } from '@/lib/wizard/steps/CustomerProfileStep'
import { PlanLifecycleStep } from '@/lib/wizard/steps/PlanLifecycleStep'
import { FrameworkSelectionStep } from '@/lib/wizard/steps/FrameworkSelectionStep'
import { IntegrationSetupStep } from '@/lib/wizard/steps/IntegrationSetupStep'
import { validateCustomerProfile, validatePlanLifecycle, validateFrameworkSelection, validateIntegrationIntent } from '@/lib/validation/wizard'
import { getWizardPrefill } from '@/lib/frontend/api'
import { CustomerProfileData, PlanLifecycleData, FrameworkStepData, IntegrationIntentData, ReferenceData } from '@/lib/wizard/types'

function PlaceholderStep(_props: { data?: unknown; onUpdate?: (d: unknown) => void; errors?: Record<string, string> }) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <p className="text-gray-500">This step will be implemented in a follow-up issue.</p>
      <p className="text-sm text-gray-400 mt-1">Click Next to continue.</p>
    </div>
  )
}

const REFERENCE_DATA_API = '/api/v1/internal/wizard/reference-data'
const VALIDATE_STEP_API = '/api/v1/internal/wizard/validate-step'

async function fetchReferenceData(): Promise<ReferenceData> {
  const res = await fetch(REFERENCE_DATA_API)
  if (!res.ok) throw new Error('Failed to fetch reference data')
  return res.json()
}

async function validateStepOnServer(stepNumber: number, data: any): Promise<Record<string, string>> {
  try {
    const res = await fetch(VALIDATE_STEP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepNumber, data }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return body.errors || { _form: 'Validation unavailable — try again' }
    }
    const result = await res.json()
    return result.errors || {}
  } catch {
    return { _form: 'Validation unavailable — try again' }
  }
}

const FRAMEWORKS_API = '/api/v1/internal/wizard/frameworks'
const INTEGRATIONS_API = '/api/v1/internal/wizard/integrations'

async function saveFrameworkSelections(data: FrameworkStepData): Promise<Record<string, string>> {
  if (!data.organization_id) {
    return { _form: 'Organization ID is required. Complete previous steps first.' }
  }
  try {
    const res = await fetch(FRAMEWORKS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { _form: body.message || 'Failed to save framework selections' }
    }
    return {}
  } catch {
    return { _form: 'Failed to save framework selections — try again' }
  }
}

async function saveIntegrationIntent(data: IntegrationIntentData): Promise<Record<string, string>> {
  if (!data.organization_id) {
    return { _form: 'Organization ID is required. Complete previous steps first.' }
  }
  try {
    const res = await fetch(INTEGRATIONS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { _form: body.message || 'Failed to save integration intent' }
    }
    return {}
  } catch {
    return { _form: 'Failed to save integration intent — try again' }
  }
}

const steps: WizardStep[] = [
  {
    stepNumber: 1,
    label: 'Customer Profile',
    component: CustomerProfileStep,
    validate: validateCustomerProfile,
    serverValidate: (data: CustomerProfileData) => validateStepOnServer(1, data),
  },
  {
    stepNumber: 2,
    label: 'Plan & Lifecycle',
    component: PlanLifecycleStep,
    validate: validatePlanLifecycle,
    serverValidate: (data: PlanLifecycleData) => validateStepOnServer(2, data),
  },
  {
    stepNumber: 3,
    label: 'Primary Admin',
    component: PlaceholderStep,
    validate: () => ({}),
  },
  {
    stepNumber: 4,
    label: 'Modules',
    component: PlaceholderStep,
    validate: () => ({}),
  },
  {
    stepNumber: 5,
    label: 'Framework & Governance',
    component: FrameworkSelectionStep,
    validate: validateFrameworkSelection,
    serverValidate: (data: FrameworkStepData) => saveFrameworkSelections(data),
  },
  {
    stepNumber: 6,
    label: 'Domain & Integrations',
    component: IntegrationSetupStep,
    validate: validateIntegrationIntent,
    serverValidate: (data: IntegrationIntentData) => saveIntegrationIntent(data),
  },
]

function useLeadPrefill(leadId: string | null) {
  const { updateStepData, setOrganizationId } = useWizard()
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [prefillError, setPrefillError] = useState<string | null>(null)

  useEffect(() => {
    if (!leadId) return

    let cancelled = false
    setPrefillLoading(true)
    setPrefillError(null)

    getWizardPrefill(leadId)
      .then((response) => {
        if (cancelled) return

        if (response.organizationId) setOrganizationId(response.organizationId)
        if (response.step1) updateStepData(1, response.step1)
        if (response.step2) updateStepData(2, response.step2)
        if (response.step3) updateStepData(3, response.step3)
        if (response.step4) updateStepData(4, response.step4)
        if (response.step5) updateStepData(5, response.step5)
        if (response.step6) updateStepData(6, response.step6)

        setPrefillLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        const message = err?.message || 'Could not load lead data, starting with empty form'
        setPrefillError(message)
        setPrefillLoading(false)
      })

    return () => { cancelled = true }
  }, [leadId, updateStepData])

  return { prefillLoading, prefillError }
}

function WizardContent() {
  const { currentStep, step1, step2, step3, step4, step5, step6, errors, updateStepData } = useWizard()
  const [owners, setOwners] = useState<ReferenceData['owners']>([])
  const searchParams = useSearchParams()
  const leadId = searchParams?.get('leadId') || null
  const { prefillLoading, prefillError } = useLeadPrefill(leadId)

  useEffect(() => {
    let mounted = true
    fetchReferenceData()
      .then((data) => {
        if (mounted) setOwners(data.owners)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const stepDataMap: Record<number, unknown> = {
    1: step1,
    2: step2,
    3: step3,
    4: step4,
    5: step5,
    6: step6,
  }
  const data = stepDataMap[currentStep]
  const StepComponent = steps[currentStep - 1]?.component

  if (prefillLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <svg className="animate-spin mx-auto h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">Loading lead data...</p>
        </div>
      </div>
    )
  }

  if (!StepComponent) return null

  if (currentStep === 1) {
    return (
      <StepComponent
        data={data}
        onUpdate={(data) => updateStepData(currentStep, data)}
        errors={errors}
        owners={owners}
      />
    )
  }

  return (
    <StepComponent
      data={data}
      onUpdate={(data) => updateStepData(currentStep, data)}
      errors={errors}
    />
  )
}

export default function WizardPage() {
  return (
    <WizardProvider steps={steps}>
      <WizardShell>
        <WizardContent />
      </WizardShell>
    </WizardProvider>
  )
}