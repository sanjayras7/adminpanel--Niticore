'use client'

import React from 'react'
import { WizardStep, useWizard } from '@/lib/wizard/WizardContext'

interface WizardShellProps {
  children: React.ReactNode
}

export function WizardShell({ children }: WizardShellProps) {
  const { currentStep, steps, isValidating, goBack, goNext } = useWizard()

  const totalSteps = steps.length
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">Onboarding Wizard</h1>
              <div className="flex items-center space-x-2">
                {steps.map((step, index) => (
                  <React.Fragment key={step.stepNumber}>
                    <div className={`flex items-center h-8 w-8 rounded-full text-sm font-medium ${
                      index + 1 < currentStep
                        ? 'bg-green-500 text-white'
                        : index + 1 === currentStep
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {index + 1 < currentStep ? (
                        <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.stepNumber
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`w-16 h-1 mx-1 ${
                        index + 1 < currentStep ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-medium text-gray-900">{steps[currentStep - 1]?.label}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Step {currentStep} of {totalSteps}
              </p>
            </div>

            {children}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
            <button
              onClick={goBack}
              disabled={currentStep === 1 || isValidating}
              className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                currentStep === 1 || isValidating
                  ? 'text-gray-300 bg-gray-100 cursor-not-allowed'
                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
              }`}
              aria-disabled={currentStep === 1 || isValidating}
            >
              Back
            </button>

            <button
              onClick={() => goNext()}
              disabled={isValidating}
              className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                isValidating
                  ? 'text-white bg-blue-400 cursor-not-allowed'
                  : 'text-white bg-blue-600 hover:bg-blue-700'
              }`}
              aria-disabled={isValidating}
            >
              {isValidating ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Validating...
                </span>
              ) : currentStep === totalSteps ? (
                'Submit'
              ) : (
                'Next'
              )}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          All data is saved in your browser session. Refreshing the page will reset the wizard.
        </p>
      </div>
    </div>
  )
}