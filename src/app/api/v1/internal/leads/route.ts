import { NextRequest, NextResponse } from 'next/server'
import { Op } from 'sequelize'
import { Lead } from '@/lib/models'
import { requirePermission } from '@/lib/auth/requirePermission'
import type { InternalSessionUser } from '@/lib/auth/session'

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface LeadListQuery {
  search?: string
  status?: string
  owner?: string
  source?: string
  framework?: string
  created_from?: string
  created_to?: string
  page: number
  limit: number
}

function parseQueryParams(url: URL): LeadListQuery {
  let search: string | undefined
  const searchRaw = url.searchParams.get('search')
  if (searchRaw && searchRaw.length >= 2) {
    search = searchRaw
  }

  let owner: string | undefined
  const ownerRaw = url.searchParams.get('owner')
  if (ownerRaw && VALID_UUID.test(ownerRaw)) {
    owner = ownerRaw
  }

  let page = parseInt(url.searchParams.get('page') || '1', 10)
  if (isNaN(page) || page < 1) page = 1

  let limit = parseInt(url.searchParams.get('limit') || '20', 10)
  if (isNaN(limit) || limit < 1) limit = 20
  if (limit > 100) limit = 100

  return {
    search,
    status: url.searchParams.get('status') || undefined,
    owner,
    source: url.searchParams.get('source') || undefined,
    framework: url.searchParams.get('framework') || undefined,
    created_from: url.searchParams.get('created_from') || undefined,
    created_to: url.searchParams.get('created_to') || undefined,
    page,
    limit,
  }
}

const LEAD_LIST_ATTRIBUTES = [
  'id', 'company_name', 'contact_first_name', 'contact_last_name',
  'work_email', 'phone', 'company_domain', 'company_website',
  'country', 'region', 'company_size', 'source', 'status',
  'assigned_owner_id', 'nda_required', 'demo_status', 'contract_status',
  'created_at',
] as const

async function handler(
  request: NextRequest,
  { internalUser }: { internalUser: InternalSessionUser },
): Promise<NextResponse> {
  const url = new URL(request.url)
  const params = parseQueryParams(url)

  const where: Record<string, unknown> = { deleted_at: null }

  if (params.search) {
    const term = `%${params.search}%`
    where[Op.or as string] = [
      { company_name: { [Op.iLike]: term } },
      { contact_first_name: { [Op.iLike]: term } },
      { contact_last_name: { [Op.iLike]: term } },
      { work_email: { [Op.iLike]: term } },
      { company_domain: { [Op.iLike]: term } },
    ]
  }

  if (params.status) {
    where.status = params.status
  }

  if (params.owner) {
    where.assigned_owner_id = params.owner
  }

  if (params.source) {
    where.source = params.source
  }

  if (params.framework) {
    where.interested_frameworks_json = { [Op.contains]: [params.framework] }
  }

  if (params.created_from || params.created_to) {
    const dateFilter: Record<string, Date> = {}
    if (params.created_from) dateFilter[Op.gte as string] = new Date(params.created_from)
    if (params.created_to) dateFilter[Op.lte as string] = new Date(params.created_to)
    where.created_at = dateFilter
  }

  try {
    const { rows, count } = await Lead.findAndCountAll({
      where,
      attributes: LEAD_LIST_ATTRIBUTES,
      order: [['created_at', 'DESC']],
      offset: (params.page - 1) * params.limit,
      limit: params.limit,
    })

    return NextResponse.json({
      data: rows,
      total: count,
      page: params.page,
      limit: params.limit,
    })
  } catch (err) {
    console.error('[LEADS] Database error during lead list query:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }
}

export const GET = requirePermission('leads', 'read')(handler)
