'use client'

import type { TenantIdentity } from '@/lib/queries/tenant'

interface Props {
  tenant: TenantIdentity
  error?: string
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  provisioning: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-red-100 text-red-800',
}

export default function TenantIdentityCard({ tenant, error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Tenant Identity & Status</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : (
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Organization Name</dt>
            <dd className="font-medium text-gray-900">{tenant.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Tenant Hash</dt>
            <dd className="font-mono text-sm text-gray-900">{tenant.tenantHash}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Plan</dt>
            <dd className="font-medium text-gray-900">{tenant.plan}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[tenant.status] || 'bg-gray-100 text-gray-800'}`}>
                {tenant.status}
              </span>
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-sm text-gray-500">Created</dt>
            <dd className="text-gray-900">{new Date(tenant.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}
