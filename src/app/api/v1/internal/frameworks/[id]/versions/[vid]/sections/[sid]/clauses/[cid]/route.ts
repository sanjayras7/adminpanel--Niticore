import { NextRequest, NextResponse } from 'next/server'
import { FrameworkVersion, FrameworkClause } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
import { ensureDraftVersion } from '@/lib/framework-versioning'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; vid: string; sid: string; cid: string } },
): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  try {
    const clause = await FrameworkClause.findByPk(params.cid)
    if (!clause) {
      return NextResponse.json({ error: 'not_found', message: 'Clause not found' }, { status: 404 })
    }

    return NextResponse.json({ data: clause.toJSON() })
  } catch (err) {
    console.error('[CLAUSES] Get error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to get clause' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; vid: string; sid: string; cid: string } },
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

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgentVal = request.headers.get('user-agent') || undefined

  try {
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
        after_values: { cloned_from_version_id: version.id, framework_id: version.framework_id, reason: 'clause update on non-draft version' },
        ip_address: ip,
        user_agent: userAgentVal,
      })
    }

    if (wasCloned && sectionIdMap) {
      const newSectionId = sectionIdMap.get(params.sid)
      if (!newSectionId) {
        return NextResponse.json({ error: 'clone_mismatch', message: 'Could not find corresponding section in cloned version.' }, { status: 500 })
      }

      const clause = await FrameworkClause.findByPk(params.cid)
      if (!clause) {
        return NextResponse.json({ error: 'not_found', message: 'Clause not found' }, { status: 404 })
      }

      if (body.clause_code !== undefined) {
        if (typeof body.clause_code !== 'string' || !body.clause_code.trim()) {
          return NextResponse.json({ error: 'invalid_request', message: 'clause_code must be a non-empty string.' }, { status: 400 })
        }
        clause.clause_code = body.clause_code.trim()
      }
      if (body.clause_text !== undefined) {
        if (typeof body.clause_text !== 'string' || !body.clause_text.trim()) {
          return NextResponse.json({ error: 'invalid_request', message: 'clause_text must be a non-empty string.' }, { status: 400 })
        }
        clause.clause_text = body.clause_text.trim()
      }
      if (body.sort_order !== undefined) {
        clause.sort_order = body.sort_order
      }

      await clause.save()

      await writeAuditEvent({
        actor_internal_user_id: authUser.id,
        actor_role: authUser.roleName,
        action: 'clause.update',
        target_type: 'framework_clause',
        target_id: clause.id,
        after_values: { clause_code: clause.clause_code },
        ip_address: ip,
        user_agent: userAgentVal,
      })

      return NextResponse.json({ data: clause.toJSON(), cloned_version_id: draftVersion.id })
    }

    const clause = await FrameworkClause.findByPk(params.cid)
    if (!clause) {
      return NextResponse.json({ error: 'not_found', message: 'Clause not found' }, { status: 404 })
    }

    if (body.clause_code !== undefined) {
      if (typeof body.clause_code !== 'string' || !body.clause_code.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'clause_code must be a non-empty string.' }, { status: 400 })
      }
      clause.clause_code = body.clause_code.trim()
    }
    if (body.clause_text !== undefined) {
      if (typeof body.clause_text !== 'string' || !body.clause_text.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'clause_text must be a non-empty string.' }, { status: 400 })
      }
      clause.clause_text = body.clause_text.trim()
    }
    if (body.sort_order !== undefined) {
      clause.sort_order = body.sort_order
    }

    await clause.save()

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'clause.update',
      target_type: 'framework_clause',
      target_id: clause.id,
      after_values: { clause_code: clause.clause_code },
      ip_address: ip,
      user_agent: userAgentVal,
    })

    return NextResponse.json({ data: clause.toJSON() })
  } catch (err) {
    console.error('[CLAUSES] Update error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to update clause' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; vid: string; sid: string; cid: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  try {
    const version = await FrameworkVersion.findByPk(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    if (version.status !== 'draft') {
      return NextResponse.json(
        { error: 'invalid_action', message: 'Cannot delete clauses from a non-draft version.' },
        { status: 409 },
      )
    }

    const clause = await FrameworkClause.findByPk(params.cid)
    if (!clause) {
      return NextResponse.json({ error: 'not_found', message: 'Clause not found' }, { status: 404 })
    }

    await clause.destroy()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgentVal = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'clause.delete',
      target_type: 'framework_clause',
      target_id: params.cid,
      ip_address: ip,
      user_agent: userAgentVal,
    })

    return NextResponse.json({ data: { id: params.cid } })
  } catch (err) {
    console.error('[CLAUSES] Delete error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to delete clause' }, { status: 500 })
  }
}
