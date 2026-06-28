import type { InternalRoleName } from '@/lib/permission-matrix'

export interface SearchResult {
  id: string
  type: 'lead' | 'tenant' | 'audit'
  title: string
  subtitle: string
  url: string
}

export interface SearchContext {
  userId: string
  roleName: InternalRoleName
}

export interface SearchProvider {
  type: 'lead' | 'tenant' | 'audit'
  search(q: string, ctx: SearchContext): Promise<SearchResult[]>
}
