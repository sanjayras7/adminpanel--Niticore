'use client'

import React, { useEffect, useState } from 'react'
import { WizardProvider, useWizard, WizardStep } from '@/lib/wizard/WizardContext'
import { WizardShell } from '@/lib/wizard/WizardShell'
import { CustomerProfileStep } from '@/lib/wizard/steps/CustomerProfileStep'
import { PlanLifecycleStep } from '@/lib/wizard/steps/PlanLifecycleStep'
import { validateCustomerProfile, validatePlanLifecycle } from '@/lib/validation/wizard'
import { CustomerProfileData, PlanLifecycleData, ReferenceData } from '@/lib/wizard/types'

const REFERENCE_DATA_API = '/api/v1/internal/wizard/reference-data'
const VALIDATE_STEP_API = '/api/v1/internal/wizard/validate-step'

async function fetchReferenceData(): Promise<ReferenceData> {
  const res = await fetch(REFERENCE_DATA_API)
  if (!res.ok) throw new Error('Failed to fetch reference data')
  return res.json()
}

async function validateStepOnServer(stepNumber: number, data: any): Promise<Record<string, string>> {
  const res = await fetch(VALIDATE_STEP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepNumber, data }),
  })
  if (!res.ok) return {}
  const result = await res.json()
  return result.errors || {}
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
]

function WizardContent() {
  const { currentStep, step1, step2, errors, updateStepData, goNext, goBack } = useWizard()
  const [owners, setOwners] = useState<ReferenceData['owners']>([])

  useEffect(() => {
    let mounted = true
    fetchReferenceData()
      .then((data) => {
        if (mounted) setOwners(data.owners)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const data = currentStep === 1 ? step1 : step2
  const StepComponent = steps[currentStep - 1]?.component

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