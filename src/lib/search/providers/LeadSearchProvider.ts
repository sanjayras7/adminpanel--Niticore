import { SearchProvider, SearchResult, SearchContext } from '@/lib/search/types'

export class LeadSearchProvider implements SearchProvider {
  readonly type = 'lead' as const

  async search(_q: string, _ctx: SearchContext): Promise<SearchResult[]> {
    return []
  }
}
