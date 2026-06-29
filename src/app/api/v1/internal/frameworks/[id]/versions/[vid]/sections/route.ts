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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; vid: string } },
): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  try {
    const version = await FrameworkVersion.findByPk(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    const sections = await FrameworkSection.findAll({
      where: { framework_version_id: params.vid },
      include: [{ model: FrameworkSection, as: 'childSections' }],
      order: [['sort_order', 'ASC']],
    })

    const sectionMap = new Map<string, Record<string, unknown>>()
    const roots: Record<string, unknown>[] = []

    for (const s of sections) {
      sectionMap.set(s.id, {
        id: s.id,
        framework_version_id: s.framework_version_id,
        parent_section_id: s.parent_section_id,
        section_code: s.section_code,
        title: s.title,
        description: s.description,
        sort_order: s.sort_order,
        child_sections: [],
      })
    }

    for (const s of sections) {
      const node = sectionMap.get(s.id)!
      if (s.parent_section_id && sectionMap.has(s.parent_section_id)) {
        const parent = sectionMap.get(s.parent_section_id)!
        ;(parent.child_sections as Record<string, unknown>[]).push(node)
      } else {
        roots.push(node)
      }
    }

    return NextResponse.json({ data: roots, total: sections.length })
  } catch (err) {
    console.error('[SECTIONS] List error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to list sections' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; vid: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json({ error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' }, { status })
  }

  let body: { section_code?: string; title?: string; description?: string; parent_section_id?: string; sort_order?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.section_code || typeof body.section_code !== 'string' || !body.section_code.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'section_code is required.' }, { status: 400 })
  }
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'title is required.' }, { status: 400 })
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

    if (body.parent_section_id) {
      if (body.parent_section_id === 'self') {
        return NextResponse.json({ error: 'invalid_request', message: 'Section cannot be its own parent.' }, { status: 400 })
      }

      const parentSection = await FrameworkSection.findByPk(body.parent_section_id)
      if (!parentSection) {
        return NextResponse.json({ error: 'not_found', message: 'Parent section not found.' }, { status: 404 })
      }

      if (await isDescendant(body.parent_section_id, params.vid, body.parent_section_id)) {
        return NextResponse.json({ error: 'invalid_request', message: 'Circular section reference detected.' }, { status: 400 })
      }
    }

    const section = await FrameworkSection.create({
      id: uuidv4(),
      framework_version_id: version.id,
      parent_section_id: body.parent_section_id || null,
      section_code: body.section_code.trim(),
      title: body.title.trim(),
      description: body.description || null,
      sort_order: body.sort_order ?? 0,
    } as FrameworkSection)

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'section.create',
      target_type: 'framework_section',
      target_id: section.id,
      after_values: { framework_version_id: version.id, section_code: body.section_code.trim(), title: body.title.trim() },
      ip_address: ip,
      user_agent: userAgentVal,
    })

    const responseData: Record<string, unknown> = { data: section.toJSON() }
    if (clonedVersionId) {
      responseData.cloned_version_id = clonedVersionId
    }

    return NextResponse.json(responseData, { status: clonedVersionId ? 200 : 201 })
  } catch (err) {
    console.error('[SECTIONS] Create error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to create section' }, { status: 500 })
  }
}

async function isDescendant(sectionId: string, versionId: string, originalSectionId: string): Promise<boolean> {
  if (sectionId === originalSectionId) return true

  const childSections = await FrameworkSection.findAll({
    where: { parent_section_id: sectionId, framework_version_id: versionId },
  })

  for (const child of childSections) {
    if (await isDescendant(child.id, versionId, originalSectionId)) {
      return true
    }
  }

  return false
}
