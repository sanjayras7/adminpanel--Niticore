import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize'
import { ControlVersion, ControlImplementationStep, ControlEvidenceType } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
import { cloneVersion } from '@/lib/control-versioning'

async function getVersionOr404(vid: string) {
  const version = await ControlVersion.findByPk(vid, {
    include: [
      {
        model: ControlImplementationStep,
        as: 'implementationSteps',
      },
      {
        model: ControlEvidenceType,
        as: 'evidenceTypes',
      },
    ],
  })
  return version
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

    const json = version.toJSON() as unknown as Record<string, unknown>
    const steps = (json.implementationSteps as Record<string, unknown>[] | undefined) || []
    const evidenceTypes = (json.evidenceTypes as Record<string, unknown>[] | undefined) || []

    const data = {
      ...json,
      implementation_steps: steps,
      evidence_types: evidenceTypes,
      implementationSteps: undefined,
      evidenceTypes: undefined,
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[CONTROL VERSIONS] Get error:', err)
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
    const version = await ControlVersion.findByPk(params.vid)
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

      const existing = await ControlVersion.findOne({
        where: { control_id: version.control_id, version_label: body.version_label.trim(), id: { [Op.ne]: version.id } },
        paranoid: false,
      })
      if (existing) {
        return NextResponse.json(
          { error: 'conflict', message: 'A version with this label already exists for this control.' },
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
      action: 'control_version.update',
      target_type: 'control_version',
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
        { error: 'conflict', message: 'A version with this label already exists for this control.' },
        { status: 409 },
      )
    }
    console.error('[CONTROL VERSIONS] Update error:', err)
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
    const version = await ControlVersion.findByPk(params.vid, {
      include: [
        { model: ControlImplementationStep, as: 'implementationSteps' },
        { model: ControlEvidenceType, as: 'evidenceTypes' },
      ],
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

    const steps = version.get('implementationSteps') as ControlImplementationStep[] | undefined
    if (steps) {
      for (const step of steps) {
        await step.destroy()
      }
    }

    const evidenceTypes = version.get('evidenceTypes') as ControlEvidenceType[] | undefined
    if (evidenceTypes) {
      for (const et of evidenceTypes) {
        await et.destroy()
      }
    }

    await version.destroy()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'control_version.delete',
      target_type: 'control_version',
      target_id: params.vid,
      ip_address: ip,
      user_agent: userAgent,
    })

    return NextResponse.json({ data: { id: params.vid } })
  } catch (err) {
    console.error('[CONTROL VERSIONS] Delete error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to delete version' }, { status: 500 })
  }
}
