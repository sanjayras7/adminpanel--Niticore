'use client'

import { useState, useCallback, useEffect } from 'react'
import type {
  AuditTimelineEvent,
  AuditTimelineResponse,
  AuditTimelineError,
} from '@/types/audit-timeline'

interface UseAuditTimelineOptions {
  leadId?: string
  organizationId?: string
  limit?: number
  autoFetch?: boolean
}

interface UseAuditTimelineReturn {
  events: AuditTimelineEvent[]
  loading: boolean
  error: AuditTimelineError | null
  nextCursor: string | null
  hasMore: boolean
  fetchEvents: (cursor?: string) => Promise<void>
  loadMore: () => Promise<void>
  reset: () => void
}

export function useAuditTimeline({
  leadId,
  organizationId,
  limit = 50,
  autoFetch = true,
}: UseAuditTimelineOptions): UseAuditTimelineReturn {
  const [events, setEvents] = useState<AuditTimelineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AuditTimelineError | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const validateParams = useCallback((): boolean => {
    const hasLead = Boolean(leadId && leadId.trim())
    const hasOrg = Boolean(organizationId && organizationId.trim())

    if ((hasLead && hasOrg) || (!hasLead && !hasOrg)) {
      setError({
        error: 'invalid_request',
        message: 'Provide exactly one of leadId or organizationId.',
      })
      return false
    }

    const idToValidate = hasLead ? leadId! : organizationId!
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(idToValidate)) {
      setError({
        error: 'invalid_request',
        message: `${hasLead ? 'leadId' : 'organizationId'} must be a valid UUID.`,
      })
      return false
    }

    return true
  }, [leadId, organizationId])

  const fetchEvents = useCallback(
    async (cursor?: string) => {
      if (!validateParams()) return

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (leadId) params.set('lead_id', leadId)
        if (organizationId) params.set('organization_id', organizationId)
        params.set('limit', String(limit))
        if (cursor) params.set('cursor', cursor)

        const response = await fetch(`/api/v1/audit/timeline?${params.toString()}`, {
          headers: { Accept: 'application/json' },
        })

        if (!response.ok) {
          const errorData: AuditTimelineError = await response.json().catch(() => ({
            error: 'server_error',
            message: 'An unexpected error occurred.',
          }))
          setError(errorData)
          return
        }

        const data: AuditTimelineResponse = await response.json()

        setEvents((prev) =>
          cursor ? [...prev, ...data.events] : data.events,
        )
        setNextCursor(data.nextCursor)
        setHasMore(Boolean(data.nextCursor))
      } catch (err) {
        setError({
          error: 'network_error',
          message: err instanceof Error ? err.message : 'Failed to fetch timeline events.',
        })
      } finally {
        setLoading(false)
      }
    },
    [leadId, organizationId, limit, validateParams],
  )

  const loadMore = useCallback(async () => {
    if (!loading && hasMore && nextCursor) {
      await fetchEvents(nextCursor)
    }
  }, [loading, hasMore, nextCursor, fetchEvents])

  const reset = useCallback(() => {
    setEvents([])
    setNextCursor(null)
    setHasMore(false)
    setError(null)
  }, [])

  useEffect(() => {
    if (autoFetch && validateParams()) {
      fetchEvents()
    }
  }, [autoFetch, fetchEvents, validateParams])

  return {
    events,
    loading,
    error,
    nextCursor,
    hasMore,
    fetchEvents,
    loadMore,
    reset,
  }
}
