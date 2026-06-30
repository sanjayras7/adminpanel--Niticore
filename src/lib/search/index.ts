import { SearchResult, SearchProvider, SearchContext } from '@/lib/search/types'
import { LeadSearchProvider } from '@/lib/search/providers/LeadSearchProvider'
import { TenantSearchProvider } from '@/lib/search/providers/TenantSearchProvider'
import { AuditSearchProvider } from '@/lib/search/providers/AuditSearchProvider'

const SEARCH_TIMEOUT_MS = 5000

const providers: SearchProvider[] = [
  new LeadSearchProvider(),
  new TenantSearchProvider(),
  new AuditSearchProvider(),
]

export interface SearchResponse {
  results: SearchResult[]
  total: number
}

export async function searchAll(q: string, ctx: SearchContext): Promise<SearchResponse> {
  if (!q || q.trim().length === 0) {
    return { results: [], total: 0 }
  }

  const results = await Promise.allSettled(
    providers.map((provider) => {
      const timeoutPromise = new Promise<SearchResult[]>((_, reject) =>
        setTimeout(() => reject(new Error(`${provider.type} search timed out`)), SEARCH_TIMEOUT_MS),
      )
      return Promise.race([provider.search(q, ctx), timeoutPromise])
    }),
  )

  const allResults: SearchResult[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      allResults.push(...result.value)
    } else {
      console.error(`[SearchService] ${providers[i].type} provider failed:`, result.reason)
    }
  }

  const sorted = allResults.sort((a, b) => a.title.localeCompare(b.title))

  return { results: sorted, total: sorted.length }
}
