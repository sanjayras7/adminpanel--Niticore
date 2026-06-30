'use client'

import React, { useEffect } from 'react'
import { useWizard } from '@/lib/wizard/WizardContext'
import { PlanLifecycleData } from '@/lib/wizard/types'

interface PlanLifecycleStepProps {
  data: PlanLifecycleData | undefined
  onUpdate: (data: PlanLifecycleData) => void
  errors: Record<string, string>
  owners?: Array<{ id: string; name: string; surname: string }>
}

export function PlanLifecycleStep({ data, onUpdate, errors }: PlanLifecycleStepProps) {
  const { setErrors } = useWizard()

  useEffect(() => {
    setErrors({})
  }, [setErrors])

  const handleChange = (field: keyof PlanLifecycleData, value: string) => {
    onUpdate({ ...data, [field]: value } as PlanLifecycleData)
  }

  const getError = (field: string) => errors[field]

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-1">
          Plan <span className="text-red-500">*</span>
        </label>
        <select
          id="plan"
          name="plan"
          value={data?.plan || ''}
          onChange={(e) => handleChange('plan', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            getError('plan') ? 'border-red-500' : 'border-gray-300'
          }`}
          aria-invalid={getError('plan') ? 'true' : 'false'}
          aria-describedby={getError('plan') ? 'plan-error' : undefined}
        >
          <option value="">Select a plan</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="enterprise">Enterprise</option>
        </select>
        {getError('plan') && (
          <p id="plan-error" className="mt-1 text-sm text-red-600" role="alert">
            {getError('plan')}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="billingRef" className="block text-sm font-medium text-gray-700 mb-1">
          Billing Reference
        </label>
        <input
          type="text"
          id="billingRef"
          name="billingRef"
          value={data?.billingRef || ''}
          onChange={(e) => handleChange('billingRef', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            getError('billingRef') ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Optional billing reference (e.g., PO number)"
          aria-invalid={getError('billingRef') ? 'true' : 'false'}
          aria-describedby={getError('billingRef') ? 'billingRef-error' : undefined}
        />
        {getError('billingRef') && (
          <p id="billingRef-error" className="mt-1 text-sm text-red-600" role="alert">
            {getError('billingRef')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="contractStart" className="block text-sm font-medium text-gray-700 mb-1">
            Contract Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="contractStart"
            name="contractStart"
            value={data?.contractStart || ''}
            onChange={(e) => handleChange('contractStart', e.target.value)}
            min={today}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              getError('contractStart') ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-invalid={getError('contractStart') ? 'true' : 'false'}
            aria-describedby={getError('contractStart') ? 'contractStart-error' : undefined}
          />
          {getError('contractStart') && (
            <p id="contractStart-error" className="mt-1 text-sm text-red-600" role="alert">
              {getError('contractStart')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="contractEnd" className="block text-sm font-medium text-gray-700 mb-1">
            Contract End Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="contractEnd"
            name="contractEnd"
            value={data?.contractEnd || ''}
            onChange={(e) => handleChange('contractEnd', e.target.value)}
            min={data?.contractStart || today}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              getError('contractEnd') ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-invalid={getError('contractEnd') ? 'true' : 'false'}
            aria-describedby={getError('contractEnd') ? 'contractEnd-error' : undefined}
          />
          {getError('contractEnd') && (
            <p id="contractEnd-error" className="mt-1 text-sm text-red-600" role="alert">
              {getError('contractEnd')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="initialStatus" className="block text-sm font-medium text-gray-700 mb-1">
          Initial Status <span className="text-red-500">*</span>
        </label>
        <select
          id="initialStatus"
          name="initialStatus"
          value={data?.initialStatus || ''}
          onChange={(e) => handleChange('initialStatus', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            getError('initialStatus') ? 'border-red-500' : 'border-gray-300'
          }`}
          aria-invalid={getError('initialStatus') ? 'true' : 'false'}
          aria-describedby={getError('initialStatus') ? 'initialStatus-error' : undefined}
        >
          <option value="">Select initial status</option>
          <option value="draft">Draft</option>
          <option value="pending_setup">Pending Setup</option>
        </select>
        {getError('initialStatus') && (
          <p id="initialStatus-error" className="mt-1 text-sm text-red-600" role="alert">
            {getError('initialStatus')}
          </p>
        )}
      </div>
    </div>
  )
}