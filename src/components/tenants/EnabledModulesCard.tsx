'use client'

import type { EnabledModule } from '@/lib/queries/tenant'

interface Props {
  modules: EnabledModule[]
  error?: string
}

export default function EnabledModulesCard({ modules, error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Enabled Modules</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : modules.length === 0 ? (
        <p className="text-sm text-gray-500">No modules configured</p>
      ) : (
        <div className="space-y-4">
          {modules.map((mod) => (
            <div key={mod.moduleId}>
              <h3 className="text-sm font-medium text-gray-900">{mod.moduleName}</h3>
              <div className="ml-4 mt-1 flex flex-wrap gap-2">
                {mod.subModules.map((sm) => (
                  <span
                    key={sm.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      sm.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    {sm.name}
                    {sm.enabled ? (
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
