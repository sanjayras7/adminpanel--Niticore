'use client'

import type { ActivityEvent } from '@/lib/queries/tenant'

interface Props {
  events: ActivityEvent[]
  error?: string
}

export default function ActivityTimelineCard({ events, error }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Activity Timeline</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">No activity recorded</p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-200" />
          <ul className="space-y-4">
            {events.map((evt) => (
              <li key={evt.id} className="relative pl-10">
                <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-blue-500 bg-white" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{evt.action}</p>
                  <p className="text-xs text-gray-500">
                    by {evt.actor} &middot; {evt.targetType}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(evt.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
