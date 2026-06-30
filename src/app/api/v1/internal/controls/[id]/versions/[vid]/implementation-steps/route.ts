import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { ControlVersion, ControlImplementationStep } from '@/lib/models'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { writeAuditEvent } from '@/lib/audit'
import { ensureDraftVersion } from '@/lib/control-versioning'

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
    const version = await ControlVersion.findByPk(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    const steps = await ControlImplementationStep.findAll({
      where: { control_version_id: params.vid },
      order: [['sort_order', 'ASC']],
    })

    return NextResponse.json({ data: steps, total: steps.length })
  } catch (err) {
    console.error('[IMPLEMENTATION STEPS] List error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to list implementation steps' }, { status: 500 })
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

  let body: { step_code?: string; title?: string; description?: string; category_id?: string; sort_order?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.step_code || typeof body.step_code !== 'string' || !body.step_code.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'step_code is required.' }, { status: 400 })
  }
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'invalid_request', message: 'title is required.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgentVal = request.headers.get('user-agent') || undefined

  try {
    const version = await ControlVersion.findByPk(params.vid)
    if (!version) {
      return NextResponse.json({ error: 'not_found', message: 'Version not found' }, { status: 404 })
    }

    const { version: draftVersion, wasCloned } = await ensureDraftVersion(version)
    if (wasCloned) {
      await writeAuditEvent({
        actor_internal_user_id: authUser.id,
        actor_role: authUser.roleName,
        action: 'control_version.clone_on_edit',
        target_type: 'control_version',
        target_id: draftVersion.id,
        after_values: { cloned_from_version_id: version.id, control_id: version.control_id, reason: 'implementation step create on non-draft version' },
        ip_address: ip,
        user_agent: userAgentVal,
      })
    }

    const step = await ControlImplementationStep.create({
      id: uuidv4(),
      control_version_id: draftVersion.id,
      step_code: body.step_code.trim(),
      title: body.title.trim(),
      description: body.description || null,
      category_id: body.category_id || null,
      sort_order: body.sort_order ?? 0,
    } as ControlImplementationStep)

    await writeAuditEvent({
      actor_internal_user_id: authUser.id,
      actor_role: authUser.roleName,
      action: 'implementation_step.create',
      target_type: 'control_implementation_step',
      target_id: step.id,
      after_values: { control_version_id: draftVersion.id, step_code: body.step_code.trim(), title: body.title.trim() },
      ip_address: ip,
      user_agent: userAgentVal,
    })

    const responseData: Record<string, unknown> = { data: step.toJSON() }
    if (wasCloned) {
      responseData.cloned_version_id = draftVersion.id
    }

    return NextResponse.json(responseData, { status: wasCloned ? 200 : 201 })
  } catch (err) {
    console.error('[IMPLEMENTATION STEPS] Create error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to create implementation step' }, { status: 500 })
  }
}
