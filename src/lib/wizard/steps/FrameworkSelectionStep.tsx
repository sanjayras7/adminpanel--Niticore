'use client'

import React, { useEffect, useState } from 'react'
import { useWizard } from '@/lib/wizard/WizardContext'
import { FrameworkStepData, FrameworkSelection } from '@/lib/wizard/types'

interface StubFramework {
  name: string
  versions: Array<{
    version: string
    controls: string[]
  }>
}

const STUB_FRAMEWORKS: StubFramework[] = [
  {
    name: 'SOC 2',
    versions: [{
      version: '2023',
      controls: ['CC1.1', 'CC1.2', 'CC1.3', 'CC1.4', 'CC1.5', 'CC2.1', 'CC2.2', 'CC2.3', 'CC3.1', 'CC3.2', 'CC3.3', 'CC4.1', 'CC4.2', 'CC5.1', 'CC5.2', 'CC5.3', 'CC6.1', 'CC6.2', 'CC6.3', 'CC6.4', 'CC6.5', 'CC6.6', 'CC6.7', 'CC6.8', 'CC7.1', 'CC7.2', 'CC7.3', 'CC7.4', 'CC7.5', 'CC8.1', 'CC9.1', 'CC9.2', 'CC10.1'],
    }],
  },
  {
    name: 'ISO 27001',
    versions: [{
      version: '2022',
      controls: ['A.5.1', 'A.5.2', 'A.5.3', 'A.5.4', 'A.5.5', 'A.6.1', 'A.6.2', 'A.6.3', 'A.7.1', 'A.7.2', 'A.7.3', 'A.7.4', 'A.8.1', 'A.8.2', 'A.8.3', 'A.8.4', 'A.8.5', 'A.8.6', 'A.8.7', 'A.8.8', 'A.8.9', 'A.8.10', 'A.8.11', 'A.8.12', 'A.8.13', 'A.8.14', 'A.8.15', 'A.8.16', 'A.9.1', 'A.9.2', 'A.9.3', 'A.9.4', 'A.10.1', 'A.10.2', 'A.11.1', 'A.11.2', 'A.11.3', 'A.12.1', 'A.12.2', 'A.12.3', 'A.12.4', 'A.12.5', 'A.12.6', 'A.12.7', 'A.13.1', 'A.13.2', 'A.14.1', 'A.14.2', 'A.14.3', 'A.15.1', 'A.15.2', 'A.16.1', 'A.17.1', 'A.17.2', 'A.18.1', 'A.18.2'],
    }],
  },
  {
    name: 'NIST CSF',
    versions: [{
      version: '2.0',
      controls: ['GV.OC', 'GV.RM', 'GV.RR', 'GV.SC', 'GV.RP', 'GV.OV', 'GV.DM', 'GV.PO', 'RA.AH', 'RA.RM', 'RA.SC', 'RA.AN', 'RA.CR', 'SB.SC', 'SB.RP', 'SB.SU', 'SB.ST', 'SB.RE', 'SB.RS', 'SB.SD', 'AN.CM', 'AN.TW', 'AN.CR', 'AN.IM', 'AN.AN', 'DE.CM', 'DE.AE', 'DE.IR', 'DE.MI', 'RS.MA', 'RS.AN', 'RS.CO', 'RS.IM', 'RS.MI', 'RC.RP', 'RC.IM', 'RC.CO'],
    }],
  },
]

const RISK_THRESHOLDS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
  { value: 'all', label: 'All' },
]

interface FrameworkSelectionStepProps {
  data: FrameworkStepData | undefined
  onUpdate: (data: FrameworkStepData) => void
  errors: Record<string, string>
}

function buildInitialSelections(data: FrameworkStepData | undefined): FrameworkSelection[] {
  if (data?.framework_selections && data.framework_selections.length > 0) {
    return data.framework_selections.map((s) => ({
      framework_id: s.framework_id ?? null,
      framework_version_id: s.framework_version_id ?? null,
      framework_name: s.framework_name ?? '',
      framework_version_name: s.framework_version_name ?? '',
      control_ids: s.control_ids ?? null,
      risk_threshold: s.risk_threshold || 'medium',
    }))
  }
  return []
}

export function FrameworkSelectionStep({ data, onUpdate, errors }: FrameworkSelectionStepProps) {
  const { organizationId } = useWizard()
  const [selections, setSelections] = useState<FrameworkSelection[]>(() =>
    buildInitialSelections(data)
  )
  const [showControls, setShowControls] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (data?.framework_selections) {
      setSelections(
        data.framework_selections.map((s) => ({
          framework_id: s.framework_id ?? null,
          framework_version_id: s.framework_version_id ?? null,
          framework_name: s.framework_name ?? '',
          framework_version_name: s.framework_version_name ?? '',
          control_ids: s.control_ids ?? null,
          risk_threshold: s.risk_threshold || 'medium',
        }))
      )
    }
  }, [data])

  const pushUpdate = (newSelections: FrameworkSelection[]) => {
    setSelections(newSelections)
    onUpdate({
      organization_id: organizationId || data?.organization_id || '',
      framework_selections: newSelections,
    })
  }

  const toggleFramework = (fw: StubFramework) => {
    const version = fw.versions[0]
    const existing = selections.find((s) => s.framework_name === fw.name)
    if (existing) {
      pushUpdate(selections.filter((s) => s.framework_name !== fw.name))
    } else {
      pushUpdate([
        ...selections,
        {
          framework_id: null,
          framework_version_id: null,
          framework_name: fw.name,
          framework_version_name: version.version,
          control_ids: version.controls,
          risk_threshold: 'medium',
        },
      ])
    }
  }

  const updateRiskThreshold = (frameworkName: string, value: string) => {
    pushUpdate(
      selections.map((s) =>
        s.framework_name === frameworkName ? { ...s, risk_threshold: value } : s
      )
    )
  }

  const toggleControl = (frameworkName: string, control: string) => {
    pushUpdate(
      selections.map((s) => {
        if (s.framework_name !== frameworkName) return s
        const current = s.control_ids || []
        const next = current.includes(control)
          ? current.filter((c: string) => c !== control)
          : [...current, control]
        return { ...s, control_ids: next }
      })
    )
  }

  const toggleSelectAll = (frameworkName: string, fw: StubFramework) => {
    const allControls = fw.versions[0].controls
    pushUpdate(
      selections.map((s) => {
        if (s.framework_name !== frameworkName) return s
        const currentCount = s.control_ids?.length || 0
        return {
          ...s,
          control_ids: currentCount < allControls.length ? allControls : [],
        }
      })
    )
  }

  const getError = (field: string) => errors[field]

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <span className="font-medium">Framework library not yet available</span>
              {' — '}selections below use stub data and will be validated when the framework library is complete.
            </p>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Select the governance frameworks applicable to this tenant. For each framework, choose a risk threshold and optionally select specific controls.
      </p>

      {selections.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-gray-500">No frameworks selected yet.</p>
          <p className="text-sm text-gray-400 mt-1">Click a framework below to add it.</p>
        </div>
      )}

      <div className="space-y-4">
        {STUB_FRAMEWORKS.map((fw) => {
          const version = fw.versions[0]
          const selected = selections.find((s) => s.framework_name === fw.name)
          const isSelected = !!selected
          const totalControls = version.controls.length
          const selectedCount = selected?.control_ids?.length || 0
          const controlsVisible = showControls[fw.name] || false

          return (
            <div
              key={fw.name}
              className={`border rounded-lg overflow-hidden transition-colors ${
                isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id={`fw-${fw.name}`}
                      checked={isSelected}
                      onChange={() => toggleFramework(fw)}
                      className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                      aria-describedby={getError('framework_selections') ? 'framework_selections-error' : undefined}
                    />
                    <div>
                      <label htmlFor={`fw-${fw.name}`} className="text-sm font-medium text-gray-900 cursor-pointer">
                        {fw.name}
                      </label>
                      <p className="text-xs text-gray-500">Version {version.version}</p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex items-center space-x-4">
                      <div>
                        <label htmlFor={`risk-${fw.name}`} className="sr-only">
                          Risk threshold for {fw.name}
                        </label>
                        <select
                          id={`risk-${fw.name}`}
                          value={selected.risk_threshold}
                          onChange={(e) => updateRiskThreshold(fw.name, e.target.value)}
                          className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {RISK_THRESHOLDS.map((rt) => (
                            <option key={rt.value} value={rt.value}>
                              {rt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {selectedCount} of {totalControls} controls
                      </span>
                    </div>
                  )}
                </div>

                {isSelected && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setShowControls((prev) => ({ ...prev, [fw.name]: !controlsVisible }))}
                      className="text-xs text-blue-600 hover:text-blue-800 focus:outline-none"
                    >
                      {controlsVisible ? 'Hide controls' : 'Show controls'}
                    </button>

                    {controlsVisible && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSelectAll(fw.name, fw)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 mb-2 focus:outline-none"
                        >
                          {selectedCount < totalControls ? 'Select all' : 'Deselect all'}
                        </button>
                        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white p-2">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                            {version.controls.map((ctrl) => {
                              const isChecked = selected?.control_ids?.includes(ctrl) || false
                              return (
                                <label
                                  key={ctrl}
                                  className="flex items-center space-x-1.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleControl(fw.name, ctrl)}
                                    className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="truncate">{ctrl}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {getError('framework_selections') && (
        <p id="framework_selections-error" className="text-sm text-red-600" role="alert">
          {getError('framework_selections')}
        </p>
      )}

      {getError('_form') && (
        <p className="text-sm text-red-600" role="alert">
          {getError('_form')}
        </p>
      )}
    </div>
  )
}
