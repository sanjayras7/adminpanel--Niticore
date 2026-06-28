import { SearchProvider, SearchResult, SearchContext } from '@/lib/search/types'

export class TenantSearchProvider implements SearchProvider {
  readonly type = 'tenant' as const

  async search(_q: string, _ctx: SearchContext): Promise<SearchResult[]> {
    return []
  }
}
