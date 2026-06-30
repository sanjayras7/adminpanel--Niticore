'use client'

import type { AuditLogEntry } from '@/lib/queries/tenant'

interface Props {
  entries: AuditLogEntry[]
  error?: string
}

export default function AuditLogTable({ entries, error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Audit Log</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">No audit events recorded</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 pr-3 font-medium text-gray-500">Action</th>
                <th className="pb-2 pr-3 font-medium text-gray-500">Actor</th>
                <th className="pb-2 pr-3 font-medium text-gray-500">Target</th>
                <th className="pb-2 pr-3 font-medium text-gray-500">Changes</th>
                <th className="pb-2 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {entry.action}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-900">{entry.actor}</td>
                  <td className="py-2 pr-3 text-gray-600">
                    {entry.targetType}/{entry.targetId.slice(0, 8)}...
                  </td>
                  <td className="py-2 pr-3 text-gray-500">
                    {entry.beforeValues || entry.afterValues ? (
                      <span className="text-xs text-yellow-600">modified</span>
                    ) : (
                      <span className="text-xs text-gray-400">&mdash;</span>
                    )}
                  </td>
                  <td className="py-2 whitespace-nowrap text-gray-500">
                    {new Date(entry.createdAt).toLocaleString()}
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
