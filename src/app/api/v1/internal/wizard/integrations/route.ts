import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { OrganizationIntegrationIntent } from '@/lib/models'
import { requirePermission } from '@/lib/auth/requirePermission'
import type { InternalSessionUser } from '@/lib/auth/session'

async function getHandler(
  request: NextRequest,
  _ctx: { internalUser: InternalSessionUser },
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organization_id')

  if (!organizationId) {
    return NextResponse.json(
      { error: 'validation_error', message: 'organization_id is required.' },
      { status: 400 },
    )
  }

  try {
    const existing = await OrganizationIntegrationIntent.findOne({
      where: { organization_id: organizationId },
    })

    return NextResponse.json({
      step: 6,
      integration_intent: existing
        ? {
            id: existing.id,
            domain: existing.domain,
            sso_required: existing.sso_required,
            sso_provider: existing.sso_provider,
            notes: existing.notes,
          }
        : null,
    })
  } catch (err) {
    console.error('[WIZARD] Error fetching integration intent:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to retrieve integration intent.' },
      { status: 500 },
    )
  }
}

async function postHandler(
  request: NextRequest,
  ctx: { internalUser: InternalSessionUser },
): Promise<NextResponse> {
  let body: {
    organization_id?: string
    domain?: string
    sso_required?: boolean
    sso_provider?: string
    notes?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (!body.organization_id || typeof body.organization_id !== 'string') {
    return NextResponse.json(
      { error: 'validation_error', message: 'organization_id is required.' },
      { status: 400 },
    )
  }

  if (body.domain && typeof body.domain !== 'string') {
    return NextResponse.json(
      { error: 'validation_error', message: 'domain must be a string.' },
      { status: 400 },
    )
  }

  if (body.sso_required !== undefined && typeof body.sso_required !== 'boolean') {
    return NextResponse.json(
      { error: 'validation_error', message: 'sso_required must be a boolean.' },
      { status: 400 },
    )
  }

  if (body.sso_provider !== undefined && body.sso_provider !== null && typeof body.sso_provider !== 'string') {
    return NextResponse.json(
      { error: 'validation_error', message: 'sso_provider must be a string.' },
      { status: 400 },
    )
  }

  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    return NextResponse.json(
      { error: 'validation_error', message: 'notes must be a string.' },
      { status: 400 },
    )
  }

  try {
    const existing = await OrganizationIntegrationIntent.findOne({
      where: { organization_id: body.organization_id },
    })

    let intent: OrganizationIntegrationIntent

    if (existing) {
      existing.domain = body.domain ?? existing.domain
      existing.sso_required = body.sso_required ?? existing.sso_required
      existing.sso_provider = body.sso_provider !== undefined ? body.sso_provider : existing.sso_provider
      existing.notes = body.notes !== undefined ? body.notes : existing.notes
      await existing.save()
      intent = existing
    } else {
      intent = await OrganizationIntegrationIntent.create({
        id: uuidv4(),
        organization_id: body.organization_id,
        domain: body.domain || null,
        sso_required: body.sso_required ?? false,
        sso_provider: body.sso_provider ?? null,
        notes: body.notes ?? null,
        created_by: ctx.internalUser.id,
      } as OrganizationIntegrationIntent)
    }

    return NextResponse.json({
      step: 6,
      integration_intent: {
        id: intent.id,
        domain: intent.domain,
        sso_required: intent.sso_required,
        sso_provider: intent.sso_provider,
        notes: intent.notes,
      },
    })
  } catch (err) {
    console.error('[WIZARD] Error saving integration intent:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to save integration intent.' },
      { status: 500 },
    )
  }
}

export const GET = requirePermission('onboarding', 'read')(getHandler)
export const POST = requirePermission('onboarding', 'update')(postHandler)
