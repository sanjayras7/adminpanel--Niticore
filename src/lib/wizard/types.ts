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

export interface AdminRequestBody {
  name: string
  surname: string
  email: string
}

export interface ModuleSelection {
  moduleId: string
  enabled: boolean
}

export interface FrameworkSelection {
  framework_id?: string | null
  framework_version_id?: string | null
  framework_name?: string
  framework_version_name?: string
  control_ids?: string[] | null
  risk_threshold: string
}

export interface FrameworkStepData {
  organization_id: string
  framework_selections: FrameworkSelection[]
  created_by?: string
}

export interface IntegrationIntentData {
  organization_id: string
  domain?: string | null
  sso_required?: boolean
  sso_provider?: string | null
  notes?: string | null
  created_by?: string
}

export interface WizardPrefillResponse {
  leadId: string
  organizationId: string
  step1?: Partial<CustomerProfileData>
  step2?: Partial<PlanLifecycleData>
  step3?: Partial<AdminRequestBody>
  step4?: ModuleSelection[]
  step5?: Partial<FrameworkStepData>
  step6?: Partial<IntegrationIntentData>
}

export interface WizardState {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6
  organizationId?: string
  step1?: CustomerProfileData
  step2?: PlanLifecycleData
  step3?: any
  step4?: any
  step5?: FrameworkStepData
  step6?: IntegrationIntentData
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