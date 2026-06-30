'use client'

import type { ApplicableFramework } from '@/lib/queries/tenant'

interface Props {
  frameworks: ApplicableFramework[]
  error?: string
}

export default function ApplicableFrameworksCard({ frameworks, error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Applicable Frameworks</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : frameworks.length === 0 ? (
        <p className="text-sm text-gray-500">No frameworks assigned</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {frameworks.map((fw) => (
            <li key={fw.frameworkId} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-900">{fw.frameworkName}</span>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                v{fw.version}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
