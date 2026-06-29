'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { WizardState, WizardStep, CustomerProfileData, PlanLifecycleData, AdminRequestBody, ModuleSelection, FrameworkStepData, IntegrationIntentData } from '@/lib/wizard/types'

export { WizardStep }

type StepData = CustomerProfileData | PlanLifecycleData | AdminRequestBody | ModuleSelection[] | FrameworkStepData | IntegrationIntentData

interface WizardContextType extends WizardState {
  steps: WizardStep[]
  goNext: (serverErrors?: Record<string, string>) => Promise<void>
  goBack: () => void
  updateStepData: (stepNumber: number, data: StepData) => void
  setErrors: (errors: Record<string, string>) => void
  clearErrors: () => void
  resetWizard: () => void
  isValidating: boolean
  setIsValidating: (isValidating: boolean) => void
}

const WizardContext = createContext<WizardContextType | undefined>(undefined)

const initialState: WizardState = {
  currentStep: 1,
  step1: undefined,
  step2: undefined,
  step3: undefined,
  step4: undefined,
  step5: undefined,
  step6: undefined,
  errors: {},
}

function getStepData(step: number, state: WizardState) {
  switch (step) {
    case 1: return state.step1
    case 2: return state.step2
    case 3: return state.step3
    case 4: return state.step4
    case 5: return state.step5
    case 6: return state.step6
    default: return undefined
  }
}

export function WizardProvider({ children, steps }: { children: ReactNode; steps: WizardStep[] }) {
  const [state, setState] = useState<WizardState>(initialState)
  const [isValidating, setIsValidating] = useState(false)

  const goNext = useCallback(
    async (serverErrors?: Record<string, string>) => {
      const currentStepDef = steps.find((s) => s.stepNumber === state.currentStep)
      if (!currentStepDef) return

      const stepData = getStepData(state.currentStep, state)
      const clientErrors = currentStepDef.validate(stepData)

      let finalErrors = { ...clientErrors }

      if (serverErrors) {
        const { errors, warnings } = processServerValidationResponse(serverErrors)
        finalErrors = { ...finalErrors, ...errors }
        if (Object.keys(warnings).length > 0) {
          console.warn('Server validation warnings:', warnings)
        }
      }

      if (Object.keys(finalErrors).length > 0) {
        setState((prev) => ({ ...prev, errors: finalErrors }))
        return
      }

      setState((prev) => ({ ...prev, errors: {} }))
      setIsValidating(true)

      try {
        if (currentStepDef.serverValidate) {
          const serverValidationErrors = await currentStepDef.serverValidate(stepData)
          if (Object.keys(serverValidationErrors).length > 0) {
            const { errors } = processServerValidationResponse(serverValidationErrors)
            if (Object.keys(errors).length > 0) {
              setState((prev) => ({ ...prev, errors }))
              return
            }
          }
        }

        const nextStep = state.currentStep + 1
        if (nextStep <= steps.length) {
          setState((prev) => ({ ...prev, currentStep: nextStep as 1 | 2 | 3 | 4 | 5 | 6, errors: {} }))
        }
      } finally {
        setIsValidating(false)
      }
    },
    [state.currentStep, state.step1, state.step2, state.step3, state.step4, state.step5, state.step6, steps]
  )

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1) as 1 | 2 | 3 | 4 | 5 | 6,
      errors: {},
    }))
  }, [])

  const updateStepData = useCallback(
    (stepNumber: number, data: StepData) => {
      setState((prev) => {
        switch (stepNumber) {
          case 1:
            return { ...prev, step1: data as CustomerProfileData }
          case 2:
            return { ...prev, step2: data as PlanLifecycleData }
          case 3:
            return { ...prev, step3: data as AdminRequestBody }
          case 4:
            return { ...prev, step4: data as ModuleSelection[] }
          case 5:
            return { ...prev, step5: data as FrameworkStepData }
          case 6:
            return { ...prev, step6: data as IntegrationIntentData }
          default:
            return prev
        }
      })
    },
    []
  )

  const setErrors = useCallback((errors: Record<string, string>) => {
    setState((prev) => ({ ...prev, errors }))
  }, [])

  const clearErrors = useCallback(() => {
    setState((prev) => ({ ...prev, errors: {} }))
  }, [])

  const resetWizard = useCallback(() => {
    setState(initialState)
    setIsValidating(false)
  }, [])

  function processServerValidationResponse(
    serverErrors: Record<string, string>
  ): { errors: Record<string, string>; warnings: Record<string, string> } {
    const errors: Record<string, string> = {}
    const warnings: Record<string, string> = {}

    for (const [field, message] of Object.entries(serverErrors)) {
      if (field === 'domain' && message.toLowerCase().includes('already')) {
        warnings[field] = message
      } else {
        errors[field] = message
      }
    }

    return { errors, warnings }
  }

  return (
    <WizardContext.Provider
      value={{
        ...state,
        steps,
        goNext,
        goBack,
        updateStepData,
        setErrors,
        clearErrors,
        resetWizard,
        isValidating,
        setIsValidating,
      }}
    >
      {children}
    </WizardContext.Provider>
  )
}

export function useWizard() {
  const context = useContext(WizardContext)
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider')
  }
  return context
}