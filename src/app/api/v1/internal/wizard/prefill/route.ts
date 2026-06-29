import { NextRequest, NextResponse } from 'next/server'
import { Lead } from '@/lib/models/Lead'
import { getAuthUser } from '@/lib/auth'
import type {
  CustomerProfileData,
  PlanLifecycleData,
  AdminRequestBody,
  ModuleSelection,
  FrameworkSelection,
  FrameworkStepData,
  IntegrationIntentData,
  WizardPrefillResponse,
} from '@/lib/wizard/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Authentication required' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')

  if (!leadId) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'leadId query parameter is required' },
      { status: 400 },
    )
  }

  if (!UUID_REGEX.test(leadId)) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'leadId must be a valid UUID' },
      { status: 400 },
    )
  }

  let lead: Lead | null
  try {
    lead = await Lead.findByPk(leadId)
  } catch (err) {
    console.error('[WIZARD_PREFILL] Database error:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch lead data' },
      { status: 500 },
    )
  }

  if (!lead) {
    return NextResponse.json(
      { error: 'not_found', message: 'Lead not found' },
      { status: 404 },
    )
  }

  if (!lead.converted_organization_id) {
    return NextResponse.json(
      {
        error: 'not_found',
        message: 'Lead has not been converted yet. Convert the lead before using wizard prefill.',
      },
      { status: 404 },
    )
  }

  let interestedModules: unknown[] = []
  if (lead.interested_modules_json) {
    const raw = lead.interested_modules_json as Record<string, unknown> | unknown[]
    if (Array.isArray(raw)) {
      interestedModules = raw
    }
  }

  let interestedFrameworks: unknown[] = []
  if (lead.interested_frameworks_json) {
    const raw = lead.interested_frameworks_json as Record<string, unknown> | unknown[]
    if (Array.isArray(raw)) {
      interestedFrameworks = raw
    }
  }

  const step1: Partial<CustomerProfileData> = {}
  if (lead.company_name) step1.tenantName = lead.company_name
  if (lead.company_domain) step1.domain = lead.company_domain
  if (lead.region) step1.region = lead.region
  if (lead.assigned_owner_id) step1.ownerId = lead.assigned_owner_id
  if (lead.message) step1.notes = lead.message

  const step2: Partial<PlanLifecycleData> = {}

  const step3: Partial<AdminRequestBody> = {}
  if (lead.contact_first_name) step3.name = lead.contact_first_name
  if (lead.contact_last_name) step3.surname = lead.contact_last_name
  if (lead.work_email) step3.email = lead.work_email

  const step4: ModuleSelection[] = interestedModules
    .filter((mod): mod is NonNullable<typeof mod> => mod != null)
    .map((mod) => {
      if (typeof mod === 'string') {
        return { moduleId: mod, enabled: true }
      }
      const m = mod as Record<string, unknown>
      return {
        moduleId: (m.id as string) || (m.moduleId as string) || '',
        enabled: true,
      }
    }).filter((m) => m.moduleId)

  const step5Selections: FrameworkSelection[] = interestedFrameworks
    .filter((fw): fw is NonNullable<typeof fw> => fw != null)
    .map((fw) => {
      if (typeof fw === 'string') {
        return { frameworkId: fw, version: null, control: null }
      }
      const f = fw as Record<string, unknown>
      return {
        frameworkId: (f.id as string) || (f.frameworkId as string) || '',
        version: (f.version as string) || null,
        control: (f.control as string) || null,
      }
    }).filter((f) => f.frameworkId)
  const step5: Partial<FrameworkStepData> = { selections: step5Selections }

  const step6: Partial<IntegrationIntentData> = {}
  if (lead.company_website) step6.domain = lead.company_website

  const response: WizardPrefillResponse = {
    leadId: lead.id,
    organizationId: lead.converted_organization_id,
  }

  if (Object.keys(step1).length > 0) response.step1 = step1
  if (Object.keys(step2).length > 0) response.step2 = step2
  if (Object.keys(step3).length > 0) response.step3 = step3
  if (step4.length > 0) response.step4 = step4
  if (step5Selections.length > 0) response.step5 = step5
  if (Object.keys(step6).length > 0) response.step6 = step6

  return NextResponse.json({ data: response })
}
