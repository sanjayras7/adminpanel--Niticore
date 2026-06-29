import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize'
import { Framework, FrameworkVersion } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const classification_id = searchParams.get('classification_id') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const page_size = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))

  const where: Record<string, unknown> = {}
  if (search) {
    where.name = { [Op.iLike]: `%${search}%` }
  }
  if (classification_id) {
    where.classification_id = classification_id
  }

  try {
    const { count, rows } = await Framework.findAndCountAll({
      where,
      include: [{ model: FrameworkVersion, as: 'versions', required: false }],
      limit: page_size,
      offset: (page - 1) * page_size,
      order: [['created_at', 'DESC']],
    })

    const data = rows.map((fw) => {
      const fwJson = fw.toJSON() as unknown as Record<string, unknown>
      return {
        ...fwJson,
        version_count: (fwJson.versions as Record<string, unknown>[] | undefined)?.length || 0,
        versions: undefined,
      }
    })

    return NextResponse.json({ data, total: count, page, page_size })
  } catch (err) {
    console.error('[FRAMEWORKS] List error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to list frameworks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  let body: { name?: string; description?: string; classification_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'Name is required.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const framework = await Framework.create({
      id: uuidv4(),
      name: body.name.trim(),
      description: body.description || null,
      classification_id: body.classification_id || null,
    } as Framework)

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'framework.create',
      target_type: 'framework',
      target_id: framework.id,
      after_values: { name: body.name.trim(), description: body.description || null, classification_id: body.classification_id || null },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: framework.toJSON() }, { status: 201 })
  } catch (err) {
    console.error('[FRAMEWORKS] Create error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to create framework' }, { status: 500 })
  }
}
