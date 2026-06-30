'use client'

import type { OnboardingChecklistItem } from '@/lib/queries/tenant'

interface Props {
  items: OnboardingChecklistItem[]
  error?: string
}

const statusIcons: Record<string, string> = {
  completed: '\u2713',
  'in-progress': '\u25D4',
  pending: '\u25CB',
  blocked: '\u2717',
}

const statusColors: Record<string, string> = {
  completed: 'text-green-600',
  'in-progress': 'text-yellow-600',
  pending: 'text-gray-400',
  blocked: 'text-red-600',
}

export default function OnboardingChecklistCard({ items, error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Onboarding Checklist</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No checklist items</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.itemKey} className="flex items-start gap-3">
              <span className={`mt-0.5 text-lg ${statusColors[item.status] || 'text-gray-400'}`}>
                {statusIcons[item.status] || '\u25CB'}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500">{item.description}</p>
                {item.status === 'completed' && item.completedBy && (
                  <p className="mt-1 text-xs text-gray-400">
                    Completed by {item.completedBy}
                    {item.completedAt ? ` on ${new Date(item.completedAt).toLocaleDateString()}` : ''}
                  </p>
                )}
              </div>
              <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                item.status === 'completed' ? 'bg-green-100 text-green-800'
                : item.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800'
                : item.status === 'blocked' ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
              }`}>
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
