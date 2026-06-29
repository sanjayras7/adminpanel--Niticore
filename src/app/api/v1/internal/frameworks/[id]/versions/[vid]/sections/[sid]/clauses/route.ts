import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { FrameworkVersion, FrameworkSection, FrameworkClause } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
import { ensureDraftVersion } from '@/lib/framework-versioning'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; vid: string; sid: string } },
): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  try {
    const section = await FrameworkSection.findByPk(params.sid)
    if (!section) {
      return NextResponse.json({ error: 'not_found', message: 'Section not found' }, { status: 404 })
    }

    const clauses = await FrameworkClause.findAll({
      where: { framework_section_id: params.sid },
      order: [['sort_order', 'ASC']],
    })

    return NextResponse.json({ data: clauses, total: clauses.length })
  } catch (err) {
    console.error('[CLAUSES] List error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to list clauses' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; vid: string; sid: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  let body: { clause_code?: string; clause_text?: string; sort_order?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.clause_code || typeof body.clause_code !== 'string' || !body.clause_code.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'clause_code is required.' }, { status: 400 })
  }
  if (!body.clause_text || typeof body.clause_text !== 'string' || !body.clause_text.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'clause_text is required.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgentVal = request.headers.get('user-agent') || undefined

  try {
    const section = await FrameworkSection.findByPk(params.sid)
    if (!section) {
      return NextResponse.json({ error: 'not_found', message: 'Section not found' }, { status: 404 })
    }

    const version = await FrameworkVersion.findByPk(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    const { version: draftVersion, wasCloned, sectionIdMap } = await ensureDraftVersion(version)
    if (wasCloned) {
      await writeAuditEvent({
        actor_internal_user_id: authUser.id,
        actor_role: authUser.roleName,
        action: 'version.clone_on_edit',
        target_type: 'framework_version',
        target_id: draftVersion.id,
        after_values: { cloned_from_version_id: version.id, framework_id: version.framework_id, reason: 'clause create on non-draft version' },
        ip_address: ip,
        user_agent: userAgentVal,
      })
    }

    const actualSid = wasCloned && sectionIdMap
      ? (sectionIdMap.get(params.sid) || params.sid)
      : params.sid

    const clause = await FrameworkClause.create({
      id: uuidv4(),
      framework_section_id: actualSid,
      clause_code: body.clause_code.trim(),
      clause_text: body.clause_text.trim(),
      sort_order: body.sort_order ?? 0,
    } as FrameworkClause)

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'clause.create',
      target_type: 'framework_clause',
      target_id: clause.id,
      after_values: { framework_section_id: actualSid, clause_code: body.clause_code.trim() },
      ip_address: ip,
      user_agent: userAgentVal,
    })

    const responseData: Record<string, unknown> = { data: clause.toJSON() }
    if (wasCloned) {
      responseData.cloned_version_id = draftVersion.id
    }

    return NextResponse.json(responseData, { status: wasCloned ? 200 : 201 })
  } catch (err) {
    console.error('[CLAUSES] Create error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to create clause' }, { status: 500 })
  }
}
