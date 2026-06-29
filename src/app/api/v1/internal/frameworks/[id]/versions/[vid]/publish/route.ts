import { NextRequest, NextResponse } from 'next/server'
import { FrameworkVersion, FrameworkSection, FrameworkClause } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'

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

  try {
    const version = await FrameworkVersion.findByPk(params.vid, {
      include: [
        {
          model: FrameworkSection,
          as: 'sections',
          include: [{ model: FrameworkClause, as: 'clauses' }],
        },
      ],
    })
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    if (version.status !== 'draft') {
      return NextResponse.json(
        { error: 'invalid_action', message: `Cannot publish a version with status '${version.status}'. Only draft versions can be published.` },
        { status: 409 },
      )
    }

    const sections = version.get('sections') as FrameworkSection[] | undefined
    if (!sections || sections.length === 0) {
      return NextResponse.json(
        { error: 'invalid_action', message: 'Cannot publish an empty version. Version must have at least one section with at least one clause.' },
        { status: 400 },
      )
    }

    let hasClause = false
    for (const section of sections) {
      const sJson = section.toJSON() as unknown as Record<string, unknown>
      const clauses = (sJson.clauses as Record<string, unknown>[] | undefined)
      if (clauses && clauses.length > 0) {
        hasClause = true
        break
      }
    }
    if (!hasClause) {
      return NextResponse.json(
        { error: 'invalid_action', message: 'Cannot publish an empty version. Version must have at least one section with at least one clause.' },
        { status: 400 },
      )
    }

    version.status = 'active'
    await version.save()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'version.publish',
      target_type: 'framework_version',
      target_id: version.id,
      after_values: { status: 'active', version_label: version.version_label, framework_id: version.framework_id },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: version.toJSON() })
  } catch (err) {
    console.error('[VERSIONS] Publish error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to publish version' }, { status: 500 })
  }
}
