import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize'
import { FrameworkVersion, FrameworkSection, FrameworkClause } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
import { cloneVersion } from '@/lib/framework-versioning'

async function getVersionOr404(vid: string) {
  const version = await FrameworkVersion.findByPk(vid, {
    include: [
      {
        model: FrameworkSection,
        as: 'sections',
        include: [
          { model: FrameworkClause, as: 'clauses' },
          { model: FrameworkSection, as: 'childSections' },
        ],
      },
    ],
  })
  return version
}

function buildSectionTree(sections: FrameworkSection[]): Record<string, unknown>[] {
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
      clauses: [],
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

  return roots
}

function buildSectionClauseTree(version: FrameworkVersion): Record<string, unknown> {
  const json = version.toJSON() as unknown as Record<string, unknown>
  const sections = (json.sections as FrameworkSection[] | undefined) || []

  const clauseMap = new Map<string, Record<string, unknown>[]>()
  for (const s of sections) {
    const sJson = s as unknown as Record<string, unknown>
    const clauses = (sJson.clauses as Record<string, unknown>[] | undefined) || []
    clauseMap.set(sJson.id as string, clauses)
  }

  const tree = buildSectionTree(sections)
  for (const root of tree) {
    attachClausesToTree(root, clauseMap)
  }

  return {
    ...json,
    sections: tree,
  }
}

function attachClausesToTree(
  node: Record<string, unknown>,
  clauseMap: Map<string, Record<string, unknown>[]>,
): void {
  const clauses = clauseMap.get(node.id as string) || []
  node.clauses = clauses

  const children = node.child_sections as Record<string, unknown>[]
  for (const child of children) {
    attachClausesToTree(child, clauseMap)
  }
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
    const version = await getVersionOr404(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    const data = buildSectionClauseTree(version)

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[VERSIONS] Get error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to get version' }, { status: 500 })
  }
}

export async function PUT(
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

  let body: { version_label?: string; description?: string; effective_date?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  try {
    const version = await FrameworkVersion.findByPk(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    if (version.status !== 'draft') {
      const { newVersion } = await cloneVersion(version)
      return NextResponse.json({
        data: Object.assign(newVersion.toJSON(), {
          cloned_from_version_id: version.id,
        }),
      }, { status: 201 })
    }

    const beforeValues = {
      version_label: version.version_label,
      description: version.description,
      effective_date: version.effective_date,
    }

    if (body.version_label !== undefined) {
      if (typeof body.version_label !== 'string' || !body.version_label.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'version_label must be a non-empty string.' }, { status: 400 })
      }

      const existing = await FrameworkVersion.findOne({
        where: { framework_id: version.framework_id, version_label: body.version_label.trim(), id: { [Op.ne]: version.id } },
        paranoid: false,
      })
      if (existing) {
        return NextResponse.json(
          { error: 'conflict', message: 'A version with this label already exists for this framework.' },
          { status: 409 },
        )
      }
      version.version_label = body.version_label.trim()
    }
    if (body.description !== undefined) {
      version.description = body.description
    }
    if (body.effective_date !== undefined) {
      version.effective_date = body.effective_date ? new Date(body.effective_date) : null
    }

    await version.save()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'version.update',
      target_type: 'framework_version',
      target_id: version.id,
      before_values: beforeValues,
      after_values: { version_label: version.version_label, description: version.description, effective_date: version.effective_date },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: version.toJSON() })
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json(
        { error: 'conflict', message: 'A version with this label already exists for this framework.' },
        { status: 409 },
      )
    }
    console.error('[VERSIONS] Update error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to update version' }, { status: 500 })
  }
}

export async function DELETE(
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

  try {
    const version = await FrameworkVersion.findByPk(params.vid, {
      include: [{ model: FrameworkSection, as: 'sections' }],
    })
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    if (version.status !== 'draft') {
      return NextResponse.json(
        { error: 'invalid_action', message: 'Only draft versions can be deleted.' },
        { status: 409 },
      )
    }

    const sections = version.get('sections') as FrameworkSection[] | undefined
    if (sections) {
      for (const section of sections) {
        const clauses = await FrameworkClause.findAll({ where: { framework_section_id: section.id } })
        for (const clause of clauses) {
          await clause.destroy()
        }
        await section.destroy()
      }
    }

    await version.destroy()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'version.delete',
      target_type: 'framework_version',
      target_id: params.vid,
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: { id: params.vid } })
  } catch (err) {
    console.error('[VERSIONS] Delete error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to delete version' }, { status: 500 })
  }
}
