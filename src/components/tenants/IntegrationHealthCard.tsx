'use client'

interface Props {
  error?: string
}

export default function IntegrationHealthCard({ error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Integration Health & Usage</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="rounded-md bg-gray-50 p-4 text-center">
          <svg className="mx-auto mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-500">Not yet available</p>
          <p className="mt-1 text-xs text-gray-400">Integration health and usage data source is pending definition.</p>
        </div>
      )}
    </div>
  )
}
