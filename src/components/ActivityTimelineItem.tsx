'use client'

import type { AuditTimelineEvent } from '@/types/audit-timeline'
import { formatTimeAgo, formatFullDate, truncateUuid, buildActorLabel } from '@/lib/audit-timeline-utils'

interface ActivityTimelineItemProps {
  event: AuditTimelineEvent
  index: number
  isLast?: boolean
}

export function ActivityTimelineItem({ event, index, isLast }: ActivityTimelineItemProps) {
  const timeAgo = formatTimeAgo(event.createdAt)
  const formattedTime = formatFullDate(event.createdAt)

  const actorLabel = buildActorLabel(event.actor.id, event.actor.role)

  return (
    <article
      className={`relative flex gap-4 ${isLast ? 'pb-0' : 'pb-6'}`}
      data-testid={`timeline-item-${index}`}
    >
      <div className="relative flex shrink-0 flex-col items-center w-8">
        <div
          className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-gray-300"
          aria-hidden="true"
        >
          <svg
            className="h-4 w-4 text-gray-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        {!isLast && (
          <div
            className="absolute top-8 bottom-0 left-1/2 w-px bg-gray-200 -translate-x-1/2"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{event.description}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="font-mono">{actorLabel}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={event.createdAt} title={formattedTime}>
                {timeAgo}
              </time>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {event.action}
          </span>
        </div>

        {event.target && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 font-mono">
              {event.target.type}: {truncateUuid(event.target.id)}
            </span>
            {event.organizationId && (
              <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 font-mono">
                org: {truncateUuid(event.organizationId)}
              </span>
            )}
            {event.leadId && (
              <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 font-mono">
                lead: {truncateUuid(event.leadId)}
              </span>
            )}
          </div>
        )}

        {(event.reason || event.beforeValues || event.afterValues) && (
          <details className="mt-3 group">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 select-none">
              Show details
            </summary>
            <div className="mt-2 space-y-1.5 text-xs text-gray-600">
              {event.reason && (
                <div className="rounded bg-gray-50 p-2 font-mono">
                  <span className="font-medium text-gray-500">Reason: </span>
                  {event.reason}
                </div>
              )}
              {event.beforeValues && (
                <div className="rounded bg-gray-50 p-2 font-mono">
                  <span className="font-medium text-gray-500">Before: </span>
                  <pre className="inline-block whitespace-pre-wrap break-words">
                    {JSON.stringify(event.beforeValues, null, 2)}
                  </pre>
                </div>
              )}
              {event.afterValues && (
                <div className="rounded bg-gray-50 p-2 font-mono">
                  <span className="font-medium text-gray-500">After: </span>
                  <pre className="inline-block whitespace-pre-wrap break-words">
                    {JSON.stringify(event.afterValues, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </article>
  )
}
