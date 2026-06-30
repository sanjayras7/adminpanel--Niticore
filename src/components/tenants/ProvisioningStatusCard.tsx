'use client'

import { useState } from 'react'
import type { ProvisioningStatus, ProvisioningDetail } from '@/lib/queries/tenant'

interface Props {
  provisioning: ProvisioningStatus
  error?: string
}

const statusColors: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
}

const detailStatusColors: Record<string, string> = {
  created: 'bg-green-100 text-green-800',
  skipped: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}

export default function ProvisioningStatusCard({ provisioning, error }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (error) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Provisioning Status</h2>
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      </div>
    )
  }

  const { log, details } = provisioning

  if (!log) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Provisioning Status</h2>
        <p className="text-sm text-gray-500">Not yet provisioned</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Provisioning Status</h2>

      <div className="mb-4">
        <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${statusColors[log.status] || 'bg-gray-100 text-gray-800'}`}>
          {log.status === 'in_progress' ? 'In Progress' : log.status.charAt(0).toUpperCase() + log.status.slice(1)}
        </span>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-gray-500">Tenant Hash</dt>
          <dd className="font-mono text-sm text-gray-900">{log.tenant_hash}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Template Version</dt>
          <dd className="font-mono text-sm text-gray-900">{log.template_version_id}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Started</dt>
          <dd className="text-sm text-gray-900">{formatDate(log.started_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Completed</dt>
          <dd className="text-sm text-gray-900">{formatDate(log.completed_at)}</dd>
        </div>
      </dl>

      {log.status === 'failed' && log.failed_table && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">
            Failed on table: <span className="font-mono">{log.failed_table}</span>
          </p>
          {log.error_message && (
            <p className="mt-1 text-sm text-red-700">{log.error_message}</p>
          )}
        </div>
      )}

      {details.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Per-Table Details ({details.length})
          </button>

          {expanded && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Schema</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Table</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Rows</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Error</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Started</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {details.map((d: ProvisioningDetail) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-900">{d.schema_name}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-900">{d.table_name}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${detailStatusColors[d.status] || 'bg-gray-100 text-gray-800'}`}>
                          {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-700">{d.rows_created}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-gray-700">
                        {d.error_message || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatDate(d.started_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatDate(d.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {details.length === 0 && log.status !== 'failed' && (
        <p className="text-sm text-gray-500">No detail records</p>
      )}
    </div>
  )
}
