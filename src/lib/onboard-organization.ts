export interface OnboardOrganizationInput {
  company_name: string
  contact_first_name: string
  contact_last_name: string
  work_email: string
  company_domain: string | null
  region: string | null
  company_size: string | null
  interested_modules_json: string[] | null
  interested_frameworks_json: string[] | null
  plan?: string | null
  billing_ref?: string | null
  contract_start_date?: string | null
  contract_end_date?: string | null
  primary_admin_name?: string | null
  primary_admin_email?: string | null
}

export async function niticore_onboard_organization(input: OnboardOrganizationInput): Promise<string> {
  throw new Error(
    'niticore_onboard_organization() is a real PostgreSQL function that runs in production. ' +
    'Its exact parameter signature and return value are unknown from this codebase. ' +
    'This stub must be replaced with the actual database call before deployment. ' +
    'See RAN-47 design doc for the parameter contract.',
  )
}
