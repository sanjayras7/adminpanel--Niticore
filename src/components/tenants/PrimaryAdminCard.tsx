'use client'

import type { PrimaryAdmin } from '@/lib/queries/tenant'

interface Props {
  admin: PrimaryAdmin | null
  error?: string
}

export default function PrimaryAdminCard({ admin, error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Primary Admin</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : !admin ? (
        <p className="text-sm text-gray-500">No primary admin assigned</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
            {admin.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{admin.name}</p>
            <p className="text-sm text-gray-500">{admin.email}</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              admin.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {admin.status}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
