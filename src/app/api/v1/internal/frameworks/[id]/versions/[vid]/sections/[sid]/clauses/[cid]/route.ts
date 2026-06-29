import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { FrameworkVersion, FrameworkSection, FrameworkClause } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

async function getVersionAndCloneIfNeeded(vid: string, authUserId: string, authRole: string | null, ip: string, userAgent?: string): Promise<{ version: FrameworkVersion | null; clonedVersionId?: string }> {
  const version = await FrameworkVersion.findByPk(vid)
  if (!version) {
    return { version: null }
  }

  if (version.status !== 'draft') {
    const sections = await FrameworkSection.findAll({
      where: { framework_version_id: version.id },
      include: [{ model: FrameworkClause, as: 'clauses' }],
    })

    const newVersionId = uuidv4()
    const newVersion = await FrameworkVersion.create({
      id: newVersionId,
      framework_id: version.framework_id,
      version_label: `${version.version_label}-draft-${Date.now()}`,
      description: version.description,
      effective_date: version.effective_date,
      status: 'draft',
    } as FrameworkVersion)

    const sectionIdMap = new Map<string, string>()

    const rootSections = sections.filter((s) => !s.parent_section_id)
    for (const section of rootSections) {
      const newSectionId = uuidv4()
      sectionIdMap.set(section.id, newSectionId)

      await FrameworkSection.create({
        id: newSectionId,
        framework_version_id: newVersionId,
        parent_section_id: null,
        section_code: section.section_code,
        title: section.title,
        description: section.description,
        sort_order: section.sort_order,
      } as FrameworkSection)

      const clauses = section.get('clauses') as FrameworkClause[] | undefined
      if (clauses) {
        for (const clause of clauses) {
          await FrameworkClause.create({
            id: uuidv4(),
            framework_section_id: newSectionId,
            clause_code: clause.clause_code,
            clause_text: clause.clause_text,
            sort_order: clause.sort_order,
          } as FrameworkClause)
        }
      }
    }

    const childSections = sections.filter((s) => s.parent_section_id)
    for (const section of childSections) {
      const newParentId = sectionIdMap.get(section.parent_section_id!)
      if (!newParentId) continue

      const newSectionId = uuidv4()
      sectionIdMap.set(section.id, newSectionId)

      await FrameworkSection.create({
        id: newSectionId,
        framework_version_id: newVersionId,
        parent_section_id: newParentId,
        section_code: section.section_code,
        title: section.title,
        description: section.description,
        sort_order: section.sort_order,
      } as FrameworkSection)

      const clauses = section.get('clauses') as FrameworkClause[] | undefined
      if (clauses) {
        for (const clause of clauses) {
          await FrameworkClause.create({
            id: uuidv4(),
            framework_section_id: newSectionId,
            clause_code: clause.clause_code,
            clause_text: clause.clause_text,
            sort_order: clause.sort_order,
          } as FrameworkClause)
        }
      }
    }

    await writeAuditEvent({
      actor_internal_user_id: authUserId,
      actor_role: authRole,
      action: 'version.clone_on_edit',
      target_type: 'framework_version',
      target_id: newVersion.id,
      after_values: { cloned_from_version_id: version.id, framework_id: version.framework_id, reason: 'clause mutation on non-draft version' },
      ip_address: ip,
      user_agent: userAgent,
    })

    return { version: newVersion, clonedVersionId: newVersion.id }
  }

  return { version }
}

async function findMappedSection(originalSectionId: string, clonedVersionId: string): Promise<string | null> {
  const originalSection = await FrameworkSection.findByPk(originalSectionId)
  if (!originalSection) return null

  const mappedSection = await FrameworkSection.findOne({
    where: {
      framework_version_id: clonedVersionId,
      section_code: originalSection.section_code,
    },
  })

  return mappedSection?.id || null
}

async function findMappedClause(originalClauseId: string, mappedSectionId: string): Promise<string | null> {
  const originalClause = await FrameworkClause.findByPk(originalClauseId)
  if (!originalClause) return null

  const mappedClause = await FrameworkClause.findOne({
    where: {
      framework_section_id: mappedSectionId,
      clause_code: originalClause.clause_code,
    },
  })

  return mappedClause?.id || null
}

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
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const { version, clonedVersionId } = await getVersionAndCloneIfNeeded(
      params.vid, authUser.id, authUser.roleName, ip, userAgent,
    )
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    if (clonedVersionId) {
      const mappedSectionId = await findMappedSection(params.sid, clonedVersionId)
      if (!mappedSectionId) {
        return NextResponse.json({ error: 'clone_mismatch', message: 'Could not find corresponding section in cloned version.' }, { status: 500 })
      }

      const mappedClauseId = await findMappedClause(params.cid, mappedSectionId)
      if (!mappedClauseId) {
        return NextResponse.json({ error: 'clone_mismatch', message: 'Could not find corresponding clause in cloned version.' }, { status: 500 })
      }

      const clause = await FrameworkClause.findByPk(mappedClauseId)
      if (!clause) {
        return NextResponse.json({ error: 'not_found', message: 'Clause not found in cloned version.' }, { status: 404 })
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
        user_agent: userAgent,
      })

      return NextResponse.json({ data: clause.toJSON(), cloned_version_id: clonedVersionId })
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
      user_agent: userAgent,
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
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'clause.delete',
      target_type: 'framework_clause',
      target_id: params.cid,
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: { id: params.cid } })
  } catch (err) {
    console.error('[CLAUSES] Delete error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to delete clause' }, { status: 500 })
  }
}
