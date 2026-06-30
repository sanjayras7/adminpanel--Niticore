'use client'

import React, { useEffect, useState } from 'react'
import { AdminRequestBody } from '@/lib/wizard/types'

interface AdminSetupStepProps {
  data: AdminRequestBody | undefined
  onUpdate: (data: AdminRequestBody) => void
  errors: Record<string, string>
}

export function AdminSetupStep({ data, onUpdate, errors }: AdminSetupStepProps) {
  const [formData, setFormData] = useState<AdminRequestBody>({
    name: '',
    surname: '',
    email: '',
    job_title: '',
    invite_timing: 'defer',
  })

  useEffect(() => {
    if (data) {
      setFormData({
        name: data.name || '',
        surname: data.surname || '',
        email: data.email || '',
        job_title: data.job_title || '',
        invite_timing: data.invite_timing || 'defer',
      })
    }
  }, [data])

  const handleChange = (field: keyof AdminRequestBody, value: string) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    onUpdate(newData)
  }

  const getError = (field: string) => errors[field]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600">
          Enter the primary admin details for this tenant. An invitation email will be sent based on your invite timing selection.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., John"
            maxLength={255}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              getError('name') ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-invalid={getError('name') ? 'true' : 'false'}
            aria-describedby={getError('name') ? 'name-error' : undefined}
          />
          {getError('name') && (
            <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
              {getError('name')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="surname" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="surname"
            name="surname"
            value={formData.surname}
            onChange={(e) => handleChange('surname', e.target.value)}
            placeholder="e.g., Doe"
            maxLength={255}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              getError('surname') ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-invalid={getError('surname') ? 'true' : 'false'}
            aria-describedby={getError('surname') ? 'surname-error' : undefined}
          />
          {getError('surname') && (
            <p id="surname-error" className="mt-1 text-sm text-red-600" role="alert">
              {getError('surname')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="e.g., john.doe@example.com"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            getError('email') ? 'border-red-500' : 'border-gray-300'
          }`}
          aria-invalid={getError('email') ? 'true' : 'false'}
          aria-describedby={getError('email') ? 'email-error' : undefined}
        />
        {getError('email') && (
          <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
            {getError('email')}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="job_title" className="block text-sm font-medium text-gray-700 mb-1">
          Job Title
        </label>
        <input
          type="text"
          id="job_title"
          name="job_title"
          value={formData.job_title || ''}
          onChange={(e) => handleChange('job_title', e.target.value)}
          placeholder="e.g., CEO, IT Manager"
          maxLength={255}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            getError('job_title') ? 'border-red-500' : 'border-gray-300'
          }`}
          aria-invalid={getError('job_title') ? 'true' : 'false'}
          aria-describedby={getError('job_title') ? 'job_title-error' : undefined}
        />
        {getError('job_title') && (
          <p id="job_title-error" className="mt-1 text-sm text-red-600" role="alert">
            {getError('job_title')}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Invite Timing <span className="text-red-500">*</span>
        </label>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              name="invite_timing"
              value="send_now"
              checked={formData.invite_timing === 'send_now'}
              onChange={(e) => handleChange('invite_timing', e.target.value)}
              className="h-4 w-4 mt-0.5 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Send invite now</span>
              <p className="text-xs text-gray-500">
                The admin will receive an invitation email immediately upon saving.
              </p>
            </div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              name="invite_timing"
              value="defer"
              checked={formData.invite_timing === 'defer'}
              onChange={(e) => handleChange('invite_timing', e.target.value)}
              className="h-4 w-4 mt-0.5 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Defer until setup complete</span>
              <p className="text-xs text-gray-500">
                The invitation will be sent after tenant provisioning is complete.
              </p>
            </div>
          </label>
        </div>
        {getError('invite_timing') && (
          <p id="invite_timing-error" className="mt-1 text-sm text-red-600" role="alert">
            {getError('invite_timing')}
          </p>
        )}
      </div>
    </div>
  )
}
