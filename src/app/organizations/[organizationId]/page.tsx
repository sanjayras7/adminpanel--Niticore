import { getTenantDetailPageData, NotFoundError } from '@/lib/queries/tenant'
import { getAuthUserFromHeaders, AuthError } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  TenantIdentityCard,
  PrimaryAdminCard,
  CustomerAdminsTable,
  EnabledModulesCard,
  ApplicableFrameworksCard,
  OnboardingChecklistCard,
  ProvisioningStatusCard,
  IntegrationHealthCard,
  ActivityTimelineCard,
  AuditLogTable,
  InternalNotesCard,
} from '@/components/tenants'
import type { TenantDetailPageResult } from '@/lib/queries/tenant'

async function fetchPageData(organizationId: string): Promise<{
  data: TenantDetailPageResult | null
  error: string | null
  errorCode: number | null
}> {
  try {
    const data = await getTenantDetailPageData(organizationId)
    return { data, error: null, errorCode: null }
  } catch (err) {
    if (err instanceof NotFoundError) {
      return { data: null, error: 'Tenant not found', errorCode: 404 }
    }
    if (err instanceof AuthError) {
      return { data: null, error: err.message, errorCode: err.statusCode }
    }
    return { data: null, error: 'An unexpected error occurred', errorCode: 500 }
  }
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: { organizationId: string }
}) {
  let authUser
  try {
    const headersList = headers()
    authUser = await getAuthUserFromHeaders(headersList)
  } catch {
    redirect('/login')
  }
  if (!authUser) {
    redirect('/login')
  }

  const { data, error, errorCode } = await fetchPageData(params.organizationId)

  if (error && errorCode === 404) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Tenant not found</h1>
          <p className="mt-2 text-gray-500">{error}</p>
          <a
            href="/organizations"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to tenants
          </a>
        </div>
      </div>
    )
  }

  if (error && errorCode === 500) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Error</h1>
          <p className="mt-2 text-gray-500">{error}</p>
          <a
            href="/organizations"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to tenants
          </a>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { sections, errors } = data

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{sections.tenant.name}</h1>
        <a
          href="/organizations"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to tenants
        </a>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">
            Some sections could not be loaded:
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-yellow-700">
            {errors.map((e, i) => (
              <li key={i}>
                <strong>{e.section}:</strong> {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <TenantIdentityCard tenant={sections.tenant} />
          <PrimaryAdminCard admin={sections.primaryAdmin} />
          <EnabledModulesCard modules={sections.enabledModules} />
          <OnboardingChecklistCard items={sections.onboardingChecklist} />
          <IntegrationHealthCard />
          <AuditLogTable entries={sections.auditLog} />
        </div>
        <div className="space-y-6">
          <CustomerAdminsTable admins={sections.customerAdmins} />
          <ApplicableFrameworksCard frameworks={sections.applicableFrameworks} />
          <ProvisioningStatusCard provisioning={sections.provisioningStatus} />
          <ActivityTimelineCard events={sections.activityTimeline} />
          <InternalNotesCard notes={sections.internalNotes} />
        </div>
      </div>
    </div>
  )
}
