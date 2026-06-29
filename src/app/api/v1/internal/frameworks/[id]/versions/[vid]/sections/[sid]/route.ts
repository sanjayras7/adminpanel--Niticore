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
      after_values: { cloned_from_version_id: version.id, framework_id: version.framework_id, reason: 'section mutation on non-draft version' },
      ip_address: ip,
      user_agent: userAgent,
    })

    return { version: newVersion, clonedVersionId: newVersion.id }
  }

  return { version }
}

async function checkCircularReference(sectionId: string, proposedParentId: string, versionId: string): Promise<boolean> {
  if (sectionId === proposedParentId) return true

  const parentSection = await FrameworkSection.findByPk(proposedParentId)
  if (!parentSection || !parentSection.parent_section_id) return false

  if (parentSection.parent_section_id === sectionId) return true

  return checkCircularReference(sectionId, parentSection.parent_section_id, versionId)
}

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
    const section = await FrameworkSection.findByPk(params.sid, {
      include: [
        { model: FrameworkClause, as: 'clauses', order: [['sort_order', 'ASC']] },
        { model: FrameworkSection, as: 'childSections' },
      ],
    })
    if (!section) {
      return NextResponse.json({ error: 'not_found', message: 'Section not found' }, { status: 404 })
    }

    return NextResponse.json({ data: section.toJSON() })
  } catch (err) {
    console.error('[SECTIONS] Get error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to get section' }, { status: 500 })
  }
}

export async function PUT(
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

  let body: { section_code?: string; title?: string; description?: string; parent_section_id?: string | null; sort_order?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgentVal = request.headers.get('user-agent') || undefined

  try {
    const { version, clonedVersionId } = await getVersionAndCloneIfNeeded(
      params.vid, authUser.id, authUser.roleName, ip, userAgentVal,
    )
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    const actualVid = clonedVersionId ? version.id : params.vid

    const section = await FrameworkSection.findOne({
      where: { id: params.sid, framework_version_id: params.vid },
    })
    if (!section) {
      return NextResponse.json({ error: 'not_found', message: 'Section not found' }, { status: 404 })
    }

    if (clonedVersionId) {
      const newSection = await FrameworkSection.findOne({
        where: { section_code: section.section_code, framework_version_id: actualVid },
      })

      if (!newSection) {
        return NextResponse.json({
          error: 'clone_mismatch',
          message: 'Section was not found in the cloned version. Please retry.',
        }, { status: 500 })
      }

      if (body.section_code !== undefined) {
        if (typeof body.section_code !== 'string' || !body.section_code.trim()) {
          return NextResponse.json({ error: 'invalid_request', message: 'section_code must be a non-empty string.' }, { status: 400 })
        }
        newSection.section_code = body.section_code.trim()
      }
      if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim()) {
          return NextResponse.json({ error: 'invalid_request', message: 'title must be a non-empty string.' }, { status: 400 })
        }
        newSection.title = body.title.trim()
      }
      if (body.description !== undefined) {
        newSection.description = body.description
      }
      if (body.parent_section_id !== undefined) {
        if (body.parent_section_id !== null && body.parent_section_id !== params.sid) {
          const circular = await checkCircularReference(newSection.id, body.parent_section_id, actualVid)
          if (circular) {
            return NextResponse.json({ error: 'invalid_request', message: 'Circular section reference detected.' }, { status: 400 })
          }
        }
        newSection.parent_section_id = body.parent_section_id
      }
      if (body.sort_order !== undefined) {
        newSection.sort_order = body.sort_order
      }

      await newSection.save()

      await writeAuditEvent({
        actor_internal_user_id: authUser.id,
        actor_role: authUser.roleName,
        action: 'section.update',
        target_type: 'framework_section',
        target_id: newSection.id,
        after_values: { section_code: newSection.section_code, title: newSection.title },
        ip_address: ip,
        user_agent: userAgentVal,
      })

      return NextResponse.json({ data: newSection.toJSON(), cloned_version_id: clonedVersionId })
    }

    if (body.section_code !== undefined) {
      if (typeof body.section_code !== 'string' || !body.section_code.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'section_code must be a non-empty string.' }, { status: 400 })
      }
      section.section_code = body.section_code.trim()
    }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'title must be a non-empty string.' }, { status: 400 })
      }
      section.title = body.title.trim()
    }
    if (body.description !== undefined) {
      section.description = body.description
    }
    if (body.parent_section_id !== undefined) {
      if (body.parent_section_id !== null) {
        const circular = await checkCircularReference(section.id, body.parent_section_id, params.vid)
        if (circular) {
          return NextResponse.json({ error: 'invalid_request', message: 'Circular section reference detected.' }, { status: 400 })
        }
      }
      section.parent_section_id = body.parent_section_id
    }
    if (body.sort_order !== undefined) {
      section.sort_order = body.sort_order
    }

    await section.save()

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'section.update',
      target_type: 'framework_section',
      target_id: section.id,
      after_values: { section_code: section.section_code, title: section.title },
      ip_address: ip,
      user_agent: userAgentVal,
    })

    return NextResponse.json({ data: section.toJSON() })
  } catch (err) {
    console.error('[SECTIONS] Update error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to update section' }, { status: 500 })
  }
}

export async function DELETE(
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

  try {
    const version = await FrameworkVersion.findByPk(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    if (version.status !== 'draft') {
      return NextResponse.json(
        { error: 'invalid_action', message: 'Cannot delete sections from a non-draft version.' },
        { status: 409 },
      )
    }

    const section = await FrameworkSection.findOne({
      where: { id: params.sid, framework_version_id: params.vid },
    })
    if (!section) {
      return NextResponse.json({ error: 'not_found', message: 'Section not found' }, { status: 404 })
    }

    const childSections = await FrameworkSection.findAll({ where: { parent_section_id: section.id } })
    for (const child of childSections) {
      const clauses = await FrameworkClause.findAll({ where: { framework_section_id: child.id } })
      for (const clause of clauses) {
        await clause.destroy()
      }
      await child.destroy()
    }

    const clauses = await FrameworkClause.findAll({ where: { framework_section_id: section.id } })
    for (const clause of clauses) {
      await clause.destroy()
    }

    await section.destroy()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgentVal = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'section.delete',
      target_type: 'framework_section',
      target_id: params.sid,
      ip_address: ip,
      user_agent: userAgentVal,
    })

    return NextResponse.json({ data: { id: params.sid } })
  } catch (err) {
    console.error('[SECTIONS] Delete error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to delete section' }, { status: 500 })
  }
}
