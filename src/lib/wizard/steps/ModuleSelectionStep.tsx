'use client'

import React, { useEffect, useState } from 'react'
import { ModuleSelection } from '@/lib/wizard/types'
import { getModules, getPlanDefaultModuleIds } from '@/lib/services/module-service'
import type { ModuleDefinition } from '@/lib/services/module-service'

interface ModuleSelectionStepProps {
  data: ModuleSelection[] | undefined
  onUpdate: (data: ModuleSelection[]) => void
  errors: Record<string, string>
}

function buildInitialSelections(existing?: ModuleSelection[]): ModuleSelection[] {
  const modules = getModules()
  const defaults = getPlanDefaultModuleIds()

  if (existing && existing.length > 0) {
    return modules.map((mod) => {
      const existingMod = existing.find((e) => e.moduleId === mod.id)
      return {
        moduleId: mod.id,
        enabled: existingMod !== undefined ? existingMod.enabled : defaults.includes(mod.id),
      }
    })
  }

  return modules.map((mod) => ({
    moduleId: mod.id,
    enabled: defaults.includes(mod.id),
  }))
}

const MODULE_CATEGORIES: Array<{ title: string; keys: string[] }> = [
  {
    title: 'Core Security',
    keys: ['auth_mfa', 'rbac'],
  },
  {
    title: 'Customer Management',
    keys: ['lead_crm', 'nda_contract', 'esign', 'doc_storage'],
  },
  {
    title: 'Onboarding & Provisioning',
    keys: ['onboarding_wizard', 'provisioning', 'tenant_ops'],
  },
  {
    title: 'Configuration',
    keys: ['framework_mgmt', 'tenant_config', 'shell_nav'],
  },
  {
    title: 'Cross-Cutting',
    keys: ['audit', 'notifications', 'support'],
  },
]

export function ModuleSelectionStep({ data, onUpdate, errors }: ModuleSelectionStepProps) {
  const [selections, setSelections] = useState<ModuleSelection[]>(() =>
    buildInitialSelections(data)
  )
  const modules = getModules()

  useEffect(() => {
    if (data && data.length > 0) {
      setSelections(buildInitialSelections(data))
    }
  }, [data])

  const moduleMap = new Map<string, ModuleDefinition>()
  for (const mod of modules) {
    moduleMap.set(mod.key, mod)
  }

  const pushUpdate = (newSelections: ModuleSelection[]) => {
    setSelections(newSelections)
    onUpdate(newSelections)
  }

  const toggleModule = (moduleId: string) => {
    pushUpdate(
      selections.map((s) =>
        s.moduleId === moduleId ? { ...s, enabled: !s.enabled } : s
      )
    )
  }

  const enabledCount = selections.filter((s) => s.enabled).length
  const totalCount = selections.length

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600">
          Enable or disable modules for this tenant. Default selections are based on the plan. You can override any module.
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {enabledCount} of {totalCount} modules enabled
        </p>
      </div>

      {MODULE_CATEGORIES.map((category) => {
        const categoryModules = category.keys
          .map((key) => moduleMap.get(key))
          .filter((m): m is ModuleDefinition => !!m)

        if (categoryModules.length === 0) return null

        const categoryEnabled = categoryModules.filter(
          (m) => selections.find((s) => s.moduleId === m.id)?.enabled
        ).length

        return (
          <div key={category.title}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                {category.title}
              </h3>
              <span className="text-xs text-gray-500">
                {categoryEnabled} / {categoryModules.length}
              </span>
            </div>
            <div className="space-y-2">
              {categoryModules.map((mod) => {
                const selection = selections.find((s) => s.moduleId === mod.id)
                const enabled = selection?.enabled ?? false

                return (
                  <label
                    key={mod.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      enabled
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleModule(mod.id)}
                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {mod.name}
                        </span>
                        <p className="text-xs text-gray-500">{mod.description}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        enabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {errors.modules && (
        <p id="modules-error" className="text-sm text-red-600" role="alert">
          {errors.modules}
        </p>
      )}

      {errors._form && (
        <p className="text-sm text-red-600" role="alert">
          {errors._form}
        </p>
      )}
    </div>
  )
}
