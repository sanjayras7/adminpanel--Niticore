'use client'

import type { CustomerAdmin } from '@/lib/queries/tenant'

interface Props {
  admins: CustomerAdmin[]
  error?: string
}

export default function CustomerAdminsTable({ admins, error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Customer Admins</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : admins.length === 0 ? (
        <p className="text-sm text-gray-500">No customer admins configured</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 pr-4 font-medium text-gray-500">Name</th>
                <th className="pb-2 pr-4 font-medium text-gray-500">Email</th>
                <th className="pb-2 pr-4 font-medium text-gray-500">Role</th>
                <th className="pb-2 pr-4 font-medium text-gray-500">Status</th>
                <th className="pb-2 font-medium text-gray-500">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-900">{a.name}</td>
                  <td className="py-2 pr-4 text-gray-600">{a.email}</td>
                  <td className="py-2 pr-4 text-gray-900">{a.role}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">
                    {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
