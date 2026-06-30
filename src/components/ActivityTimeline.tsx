'use client'

import { useAuditTimeline } from '@/hooks/useAuditTimeline'
import { ActivityTimelineItem } from '@/components/ActivityTimelineItem'
import type { AuditTimelineError } from '@/types/audit-timeline'

interface ActivityTimelineProps {
  leadId?: string
  organizationId?: string
  limit?: number
  title?: string
}

function ErrorState({ error }: { error: AuditTimelineError }) {
  const titleMap: Record<string, string> = {
    unauthorized: 'Authentication Required',
    forbidden: 'Access Denied',
    invalid_request: 'Invalid Request',
    server_error: 'Server Error',
    network_error: 'Network Error',
  }

  const iconMap: Record<string, JSX.Element> = {
    unauthorized: (
      <svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    forbidden: (
      <svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    server_error: (
      <svg className="h-10 w-10 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    network_error: (
      <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="timeline-error">
      <div className="mb-4">
        {iconMap[error.error] || (
          <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-semibold text-gray-900">
        {titleMap[error.error] || 'Error'}
      </h3>
      <p className="mt-1 text-sm text-gray-500">{error.message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="py-8" data-testid="timeline-loading">
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="flex shrink-0 flex-col items-center w-8">
              <div className="h-8 w-8 rounded-full bg-gray-200" />
              <div className="flex-1 w-px bg-gray-100" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="timeline-empty">
      <svg className="h-10 w-10 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 className="text-sm font-semibold text-gray-900">No activity yet</h3>
      <p className="mt-1 text-sm text-gray-500">
        Audit events will appear here as actions are performed.
      </p>
    </div>
  )
}

export function ActivityTimeline({
  leadId,
  organizationId,
  limit,
  title = 'Activity Timeline',
}: ActivityTimelineProps) {
  const { events, loading, error, hasMore, loadMore } = useAuditTimeline({
    leadId,
    organizationId,
    limit,
  })

  return (
    <section className="w-full" data-testid="activity-timeline">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {loading && (
          <span className="text-xs text-gray-500 animate-pulse" data-testid="timeline-loading-indicator">
            Loading...
          </span>
        )}
      </div>

      {error && <ErrorState error={error} />}

      {!error && loading && events.length === 0 && <LoadingState />}

      {!error && !loading && events.length === 0 && <EmptyState />}

      {events.length > 0 && (
        <>
          <div className="divide-y divide-gray-100">
            {events.map((event, index) => (
              <ActivityTimelineItem
                key={event.id}
                event={event}
                index={index}
                isLast={index === events.length - 1 && !hasMore}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="timeline-load-more"
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
