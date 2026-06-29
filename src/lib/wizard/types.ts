export interface CustomerProfileData {
  tenantName: string
  slug: string
  domain: string
  region: string
  ownerId: string
  notes?: string
}

export interface PlanLifecycleData {
  plan: string
  billingRef?: string
  contractStart: string
  contractEnd: string
  initialStatus: string
}

export interface WizardState {
  currentStep: 1 | 2
  step1?: CustomerProfileData
  step2?: PlanLifecycleData
  errors: Record<string, string>
}

export interface WizardStep {
  stepNumber: number
  label: string
  component: React.ComponentType<{
    data: any
    onUpdate: (data: any) => void
    errors: Record<string, string>
  }>
  validate: (data: any) => Record<string, string>
  serverValidate?: (data: any) => Promise<Record<string, string>>
}

export interface ReferenceData {
  owners: Array<{ id: string; name: string; surname: string }>
  plans: string[]
  lifecycleStatuses: string[]
}

export interface ValidateStepResponse {
  valid: boolean
  errors: Record<string, string>
}

export interface ServerValidationError {
  field: string
  message: string
  isWarning?: boolean
}