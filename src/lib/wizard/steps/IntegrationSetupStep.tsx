'use client'

import React, { useEffect, useState } from 'react'
import { useWizard } from '@/lib/wizard/WizardContext'
import { IntegrationIntentData } from '@/lib/wizard/types'

interface IntegrationSetupStepProps {
  data: IntegrationIntentData | undefined
  onUpdate: (data: IntegrationIntentData) => void
  errors: Record<string, string>
}

export function IntegrationSetupStep({ data, onUpdate, errors }: IntegrationSetupStepProps) {
  const { organizationId } = useWizard()
  const [ssoRequired, setSsoRequired] = useState(data?.sso_required ?? false)
  const [ssoProvider, setSsoProvider] = useState(data?.sso_provider ?? '')
  const [domain, setDomain] = useState(data?.domain ?? '')
  const [notes, setNotes] = useState(data?.notes ?? '')

  useEffect(() => {
    setSsoRequired(data?.sso_required ?? false)
    setSsoProvider(data?.sso_provider ?? '')
    setDomain(data?.domain ?? '')
    setNotes(data?.notes ?? '')
  }, [data])

  const pushUpdate = (fields: Partial<IntegrationIntentData>) => {
    const next: IntegrationIntentData = {
      organization_id: data?.organization_id || organizationId || '',
      domain: fields.domain !== undefined ? fields.domain : domain,
      sso_required: fields.sso_required !== undefined ? fields.sso_required : ssoRequired,
      sso_provider: fields.sso_provider !== undefined ? fields.sso_provider : ssoProvider,
      notes: fields.notes !== undefined ? fields.notes : notes,
    }
    onUpdate(next)
  }

  const handleDomainChange = (value: string) => {
    setDomain(value)
    pushUpdate({ domain: value })
  }

  const handleSsoRequiredChange = (checked: boolean) => {
    setSsoRequired(checked)
    if (!checked) {
      setSsoProvider('')
      pushUpdate({ sso_required: false, sso_provider: '' })
    } else {
      pushUpdate({ sso_required: true })
    }
  }

  const handleSsoProviderChange = (value: string) => {
    setSsoProvider(value)
    pushUpdate({ sso_provider: value })
  }

  const handleNotesChange = (value: string) => {
    setNotes(value)
    pushUpdate({ notes: value })
  }

  const getError = (field: string) => errors[field]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600">
          Configure integration intent for this tenant. In V1, these fields capture intent only — no actual SSO or domain verification logic runs.
        </p>
      </div>

      <div>
        <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
          Domain
        </label>
        <input
          type="text"
          id="domain"
          name="domain"
          value={domain}
          onChange={(e) => handleDomainChange(e.target.value)}
          placeholder="e.g., tenant.example.com"
          maxLength={255}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            getError('domain') ? 'border-red-500' : 'border-gray-300'
          }`}
          aria-invalid={getError('domain') ? 'true' : 'false'}
          aria-describedby={getError('domain') ? 'domain-error' : undefined}
        />
        <p className="text-xs text-gray-500 mt-1">The tenant&apos;s primary domain for future verification.</p>
        {getError('domain') && (
          <p id="domain-error" className="mt-1 text-sm text-red-600" role="alert">
            {getError('domain')}
          </p>
        )}
      </div>

      <div>
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={ssoRequired}
            onChange={(e) => handleSsoRequiredChange(e.target.checked)}
            className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">SSO Required</span>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-8">
          Check if single sign-on is required for this tenant.
        </p>
      </div>

      {ssoRequired && (
        <div>
          <label htmlFor="sso_provider" className="block text-sm font-medium text-gray-700 mb-1">
            SSO Provider
          </label>
          <input
            type="text"
            id="sso_provider"
            name="sso_provider"
            value={ssoProvider}
            onChange={(e) => handleSsoProviderChange(e.target.value)}
            placeholder="e.g., Okta, Azure AD"
            maxLength={100}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              getError('sso_provider') ? 'border-red-500' : 'border-gray-300'
            }`}
            aria-invalid={getError('sso_provider') ? 'true' : 'false'}
            aria-describedby={getError('sso_provider') ? 'sso_provider-error' : undefined}
          />
          {getError('sso_provider') && (
            <p id="sso_provider-error" className="mt-1 text-sm text-red-600" role="alert">
              {getError('sso_provider')}
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Optional notes about integration requirements..."
          rows={4}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            getError('notes') ? 'border-red-500' : 'border-gray-300'
          }`}
          aria-invalid={getError('notes') ? 'true' : 'false'}
          aria-describedby={getError('notes') ? 'notes-error' : undefined}
        />
        {getError('notes') && (
          <p id="notes-error" className="mt-1 text-sm text-red-600" role="alert">
            {getError('notes')}
          </p>
        )}
      </div>

      {getError('_form') && (
        <p className="text-sm text-red-600" role="alert">
          {getError('_form')}
        </p>
      )}
    </div>
  )
}
