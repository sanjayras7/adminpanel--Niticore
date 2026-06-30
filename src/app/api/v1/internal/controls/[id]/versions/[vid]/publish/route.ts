import { NextRequest, NextResponse } from 'next/server'
import { ControlVersion, ControlImplementationStep } from '@/lib/models'
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
    const version = await ControlVersion.findByPk(params.vid, {
      include: [
        {
          model: ControlImplementationStep,
          as: 'implementationSteps',
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

    const steps = version.get('implementationSteps') as ControlImplementationStep[] | undefined
    if (!steps || steps.length === 0) {
      return NextResponse.json(
        { error: 'invalid_action', message: 'Cannot publish an empty version. Version must have at least one implementation step.' },
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
      action: 'control_version.publish',
      target_type: 'control_version',
      target_id: version.id,
      after_values: { status: 'active', version_label: version.version_label, control_id: version.control_id },
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: version.toJSON() })
  } catch (err) {
    console.error('[CONTROL VERSIONS] Publish error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to publish version' }, { status: 500 })
  }
}
