'use client'

import React, { useEffect, useState } from 'react'
import { useWizard } from '@/lib/wizard/WizardContext'
import { CustomerProfileData, ReferenceData } from '@/lib/wizard/types'

interface CustomerProfileStepProps {
  data: CustomerProfileData | undefined
  onUpdate: (data: CustomerProfileData) => void
  errors: Record<string, string>
  owners: ReferenceData['owners']
}

const REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
]

const DEFAULT_DATA: CustomerProfileData = {
  tenantName: '',
  slug: '',
  domain: '',
  region: '',
  ownerId: '',
  notes: '',
}

export function CustomerProfileStep({ data, onUpdate, errors, owners }: CustomerProfileStepProps) {
  const [formData, setFormData] = useState<CustomerProfileData>(DEFAULT_DATA)
  const { goNext } = useWizard()

  useEffect(() => {
    if (data) {
      setFormData(data)
    }
  }, [data])

  const handleChange = (field: keyof CustomerProfileData, value: string) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    onUpdate(newData)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    goNext()
  }

  const renderInput = (
    label: string,
    field: keyof CustomerProfileData,
    type: string = 'text',
    placeholder: string = ''
  ) => (
    <div className="mb-6">
      <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        type={type}
        id={field}
        name={field}
        value={formData[field]}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
          errors[field] ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
        }`}
        aria-invalid={errors[field] ? 'true' : 'false'}
        aria-describedby={errors[field] ? `${field}-error` : undefined}
      />
      {errors[field] && (
        <p id={`${field}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {errors[field]}
        </p>
      )}
    </div>
  )

  const renderSelect = (label: string, field: keyof CustomerProfileData, options: Array<{ value: string; label: string }>) => (
    <div className="mb-6">
      <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <select
        id={field}
        name={field}
        value={formData[field]}
        onChange={(e) => handleChange(field, e.target.value)}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
          errors[field] ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
        }`}
        aria-invalid={errors[field] ? 'true' : 'false'}
        aria-describedby={errors[field] ? `${field}-error` : undefined}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors[field] && (
        <p id={`${field}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {errors[field]}
        </p>
      )}
    </div>
  )

  const renderTextarea = (label: string, field: keyof CustomerProfileData, placeholder: string = '', maxLength?: number) => (
    <div className="mb-6">
      <label htmlFor={field} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <textarea
        id={field}
        name={field}
        value={formData[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
          errors[field] ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'
        }`}
        aria-invalid={errors[field] ? 'true' : 'false'}
        aria-describedby={errors[field] ? `${field}-error` : maxLength ? `${field}-hint` : undefined}
      />
      {maxLength && (
        <p id={`${field}-hint`} className="mt-1 text-sm text-gray-500">
          {formData[field]?.length || 0} / {maxLength} characters
        </p>
      )}
      {errors[field] && (
        <p id={`${field}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {errors[field]}
        </p>
      )}
    </div>
  )

  const ownerOptions = owners.map((o) => ({
    value: o.id,
    label: `${o.name} ${o.surname}`,
  }))

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
          {renderInput('Tenant Name', 'tenantName', 'text', 'e.g., Acme Corporation')}
          {renderInput('Slug', 'slug', 'text', 'e.g., acme-corp')}
          <p className="text-sm text-gray-500 mb-2">Slug must be lowercase alphanumeric with hyphens only. Used in URLs.</p>
          {renderInput('Domain', 'domain', 'text', 'e.g., example.com')}
          <p className="text-sm text-gray-500 mb-2">Primary domain for this tenant. A warning will show if already registered.</p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Location & Ownership</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderSelect('Region', 'region', REGIONS)}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Owner</h3>
          <p className="text-sm text-gray-500 mb-4">
            Select the internal team member who will own this tenant.
          </p>
          {renderSelect('Owner', 'ownerId', ownerOptions)}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Notes</h3>
          {renderTextarea('Internal Notes', 'notes', 'Optional notes for the implementation team...', 2000)}
        </div>
      </div>
    </form>
  )
}