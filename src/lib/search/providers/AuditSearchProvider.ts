import { Op } from 'sequelize'
import { SearchProvider, SearchResult, SearchContext } from '@/lib/search/types'
import { can } from '@/lib/authorization'
import { InternalAuditEvent } from '@/lib/models'

export class AuditSearchProvider implements SearchProvider {
  readonly type = 'audit' as const

  async search(q: string, ctx: SearchContext): Promise<SearchResult[]> {
    if (!can(ctx.roleName, 'audit', 'read')) {
      return []
    }

    if (!q || q.trim().length === 0) {
      return []
    }

    const query = q.trim()
    try {
      const events = await InternalAuditEvent.findAll({
        where: {
          [Op.or]: [
            { action: { [Op.iLike]: `%${query}%` } },
            { target_type: { [Op.iLike]: `%${query}%` } },
            { reason: { [Op.iLike]: `%${query}%` } },
            { actor_role: { [Op.iLike]: `%${query}%` } },
          ],
        },
        order: [['created_at', 'DESC']],
        limit: 20,
      })

      return events.map((event) => ({
        id: event.id,
        type: 'audit' as const,
        title: event.action,
        subtitle: `${event.actor_role ?? 'Unknown'} · ${formatTimeAgo(event.created_at)}`,
        url: `/internal/audit/${event.id}`,
      }))
    } catch (err) {
      console.error('[AuditSearchProvider] Query failed:', err)
      return []
    }
  }
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}
