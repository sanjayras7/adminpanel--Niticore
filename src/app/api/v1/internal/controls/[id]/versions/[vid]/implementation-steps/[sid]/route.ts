import { NextRequest, NextResponse } from 'next/server'
import { ControlVersion, ControlImplementationStep } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
import { ensureDraftVersion } from '@/lib/control-versioning'

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
    const step = await ControlImplementationStep.findByPk(params.sid)
    if (!step) {
      return NextResponse.json({ error: 'not_found', message: 'Implementation step not found' }, { status: 404 })
    }

    return NextResponse.json({ data: step.toJSON() })
  } catch (err) {
    console.error('[IMPLEMENTATION STEPS] Get error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to get implementation step' }, { status: 500 })
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

  let body: { step_code?: string; title?: string; description?: string; category_id?: string | null; sort_order?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgentVal = request.headers.get('user-agent') || undefined

  try {
    const version = await ControlVersion.findByPk(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    const { version: draftVersion, wasCloned, stepIdMap } = await ensureDraftVersion(version)
    if (wasCloned) {
      await writeAuditEvent({
        actor_internal_user_id: authUser.id,
        actor_role: authUser.roleName,
        action: 'control_version.clone_on_edit',
        target_type: 'control_version',
        target_id: draftVersion.id,
        after_values: { cloned_from_version_id: version.id, control_id: version.control_id, reason: 'implementation step update on non-draft version' },
        ip_address: ip,
        user_agent: userAgentVal,
      })
    }

    if (wasCloned && stepIdMap) {
      const newStepId = stepIdMap.get(params.sid)
      if (!newStepId) {
        return NextResponse.json({ error: 'clone_mismatch', message: 'Implementation step was not found in the cloned version.' }, { status: 500 })
      }

      const newStep = await ControlImplementationStep.findByPk(newStepId)
      if (!newStep) {
        return NextResponse.json({ error: 'clone_mismatch', message: 'Implementation step was not found in the cloned version.' }, { status: 500 })
      }

      if (body.step_code !== undefined) {
        if (typeof body.step_code !== 'string' || !body.step_code.trim()) {
          return NextResponse.json({ error: 'invalid_request', message: 'step_code must be a non-empty string.' }, { status: 400 })
        }
        newStep.step_code = body.step_code.trim()
      }
      if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim()) {
          return NextResponse.json({ error: 'invalid_request', message: 'title must be a non-empty string.' }, { status: 400 })
        }
        newStep.title = body.title.trim()
      }
      if (body.description !== undefined) {
        newStep.description = body.description
      }
      if (body.category_id !== undefined) {
        newStep.category_id = body.category_id
      }
      if (body.sort_order !== undefined) {
        newStep.sort_order = body.sort_order
      }

      await newStep.save()

      await writeAuditEvent({
        actor_internal_user_id: authUser.id,
        actor_role: authUser.roleName,
        action: 'implementation_step.update',
        target_type: 'control_implementation_step',
        target_id: newStep.id,
        after_values: { step_code: newStep.step_code, title: newStep.title },
        ip_address: ip,
        user_agent: userAgentVal,
      })

      return NextResponse.json({ data: newStep.toJSON(), cloned_version_id: draftVersion.id })
    }

    const step = await ControlImplementationStep.findOne({
      where: { id: params.sid, control_version_id: params.vid },
    })
    if (!step) {
      return NextResponse.json({ error: 'not_found', message: 'Implementation step not found' }, { status: 404 })
    }

    if (body.step_code !== undefined) {
      if (typeof body.step_code !== 'string' || !body.step_code.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'step_code must be a non-empty string.' }, { status: 400 })
      }
      step.step_code = body.step_code.trim()
    }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'invalid_request', message: 'title must be a non-empty string.' }, { status: 400 })
      }
      step.title = body.title.trim()
    }
    if (body.description !== undefined) {
      step.description = body.description
    }
    if (body.category_id !== undefined) {
      step.category_id = body.category_id
    }
    if (body.sort_order !== undefined) {
      step.sort_order = body.sort_order
    }

    await step.save()

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'implementation_step.update',
      target_type: 'control_implementation_step',
      target_id: step.id,
      after_values: { step_code: step.step_code, title: step.title },
      ip_address: ip,
      user_agent: userAgentVal,
    })

    return NextResponse.json({ data: step.toJSON() })
  } catch (err) {
    console.error('[IMPLEMENTATION STEPS] Update error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to update implementation step' }, { status: 500 })
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
    const version = await ControlVersion.findByPk(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    if (version.status !== 'draft') {
      return NextResponse.json(
        { error: 'invalid_action', message: 'Cannot delete implementation steps from a non-draft version.' },
        { status: 409 },
      )
    }

    const step = await ControlImplementationStep.findOne({
      where: { id: params.sid, control_version_id: params.vid },
    })
    if (!step) {
      return NextResponse.json({ error: 'not_found', message: 'Implementation step not found' }, { status: 404 })
    }

    await step.destroy()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgentVal = request.headers.get('user-agent') || undefined

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'implementation_step.delete',
      target_type: 'control_implementation_step',
      target_id: params.sid,
      ip_address: ip,
      user_agent: userAgentVal,
    })

    return NextResponse.json({ data: { id: params.sid } })
  } catch (err) {
    console.error('[IMPLEMENTATION STEPS] Delete error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to delete implementation step' }, { status: 500 })
  }
}
