'use client'

import type { ProvisioningStatus } from '@/lib/queries/tenant'

interface Props {
  provisioning: ProvisioningStatus
  error?: string
}

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  provisioning: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  pending: 'bg-gray-100 text-gray-800',
}

export default function ProvisioningStatusCard({ provisioning, error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Provisioning Status</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <div className="mb-4">
            <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColors[provisioning.status] || 'bg-gray-100 text-gray-800'}`}>
              {provisioning.status}
            </span>
          </div>
          {provisioning.entries.length === 0 ? (
            <p className="text-sm text-gray-500">No provisioning log entries</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {provisioning.entries.map((entry) => (
                <div key={entry.id} className="rounded-md bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">{entry.action}</span>
                    <span className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</span>
                  </div>
                  {entry.detail && (
                    <p className="mt-1 text-xs text-gray-500">{entry.detail}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
