import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { OrganizationFrameworkSelection } from '@/lib/models'
import { sequelize } from '@/lib/sequelize'
import { requirePermission } from '@/lib/auth/requirePermission'
import type { InternalSessionUser } from '@/lib/auth/session'

const STUB_FRAMEWORKS = [
  {
    name: 'SOC 2',
    versions: [
      {
        version: '2023',
        controls: ['CC1.1', 'CC1.2', 'CC1.3', 'CC1.4', 'CC1.5', 'CC2.1', 'CC2.2', 'CC2.3', 'CC3.1', 'CC3.2', 'CC3.3', 'CC4.1', 'CC4.2', 'CC5.1', 'CC5.2', 'CC5.3', 'CC6.1', 'CC6.2', 'CC6.3', 'CC6.4', 'CC6.5', 'CC6.6', 'CC6.7', 'CC6.8', 'CC7.1', 'CC7.2', 'CC7.3', 'CC7.4', 'CC7.5', 'CC8.1', 'CC9.1', 'CC9.2', 'CC10.1'],
      },
    ],
  },
  {
    name: 'ISO 27001',
    versions: [
      {
        version: '2022',
        controls: ['A.5.1', 'A.5.2', 'A.5.3', 'A.5.4', 'A.5.5', 'A.6.1', 'A.6.2', 'A.6.3', 'A.7.1', 'A.7.2', 'A.7.3', 'A.7.4', 'A.8.1', 'A.8.2', 'A.8.3', 'A.8.4', 'A.8.5', 'A.8.6', 'A.8.7', 'A.8.8', 'A.8.9', 'A.8.10', 'A.8.11', 'A.8.12', 'A.8.13', 'A.8.14', 'A.8.15', 'A.8.16', 'A.9.1', 'A.9.2', 'A.9.3', 'A.9.4', 'A.10.1', 'A.10.2', 'A.11.1', 'A.11.2', 'A.11.3', 'A.12.1', 'A.12.2', 'A.12.3', 'A.12.4', 'A.12.5', 'A.12.6', 'A.12.7', 'A.13.1', 'A.13.2', 'A.14.1', 'A.14.2', 'A.14.3', 'A.15.1', 'A.15.2', 'A.16.1', 'A.17.1', 'A.17.2', 'A.18.1', 'A.18.2'],
      },
    ],
  },
  {
    name: 'NIST CSF',
    versions: [
      {
        version: '2.0',
        controls: ['GV.OC', 'GV.RM', 'GV.RR', 'GV.SC', 'GV.RP', 'GV.OV', 'GV.DM', 'GV.PO', 'RA.AH', 'RA.RM', 'RA.SC', 'RA.AN', 'RA.CR', 'SB.SC', 'SB.RP', 'SB.SU', 'SB.ST', 'SB.RE', 'SB.RS', 'SB.SD', 'SB.RS', 'AN.CM', 'AN.TW', 'AN.CR', 'AN.IM', 'AN.AN', 'AN.CM', 'DE.CM', 'DE.AE', 'DE.IR', 'DE.MI', 'RS.MA', 'RS.AN', 'RS.CO', 'RS.IM', 'RS.MI', 'RC.RP', 'RC.IM', 'RC.CO'],
      },
    ],
  },
]

const VALID_RISK_THRESHOLDS = ['low', 'medium', 'high', 'critical', 'all']

function buildStubResponse() {
  return {
    stub: true,
    message: 'Framework library not yet available — selections will be validated when Issue 12a is complete.',
    frameworks: STUB_FRAMEWORKS,
  }
}

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
    const existingSelections = await OrganizationFrameworkSelection.findAll({
      where: { organization_id: organizationId },
      order: [['created_at', 'ASC']],
    })

    if (existingSelections.length === 0) {
      return NextResponse.json({
        step: 5,
        framework_selections: [],
        available_frameworks: buildStubResponse(),
      })
    }

    const selections = existingSelections.map((s) => ({
      id: s.id,
      framework_id: s.framework_id,
      framework_version_id: s.framework_version_id,
      framework_name: s.framework_name,
      framework_version_name: s.framework_version_name,
      control_ids: s.selected_control_ids,
      risk_threshold: s.risk_threshold,
      is_stub_data: s.is_stub_data,
    }))

    return NextResponse.json({
      step: 5,
      framework_selections: selections,
      available_frameworks: buildStubResponse(),
    })
  } catch (err) {
    console.error('[WIZARD] Error fetching framework selections:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to retrieve framework selections.' },
      { status: 500 },
    )
  }
}

async function postHandler(
  request: NextRequest,
  _ctx: { internalUser: InternalSessionUser },
): Promise<NextResponse> {
  let body: {
    organization_id?: string
    framework_selections?: Array<{
      framework_id?: string
      framework_version_id?: string
      framework_name?: string
      framework_version_name?: string
      control_ids?: string[] | null
      risk_threshold?: string
    }>
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

  if (!Array.isArray(body.framework_selections)) {
    return NextResponse.json(
      { error: 'validation_error', message: 'framework_selections must be an array.' },
      { status: 400 },
    )
  }

  for (const sel of body.framework_selections) {
    if (sel.risk_threshold && !VALID_RISK_THRESHOLDS.includes(sel.risk_threshold)) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: `Invalid risk_threshold "${sel.risk_threshold}". Must be one of: ${VALID_RISK_THRESHOLDS.join(', ')}`,
        },
        { status: 400 },
      )
    }
  }

  const t = await sequelize.transaction()

  try {
    await OrganizationFrameworkSelection.destroy({
      where: { organization_id: body.organization_id },
      transaction: t,
    })

    if (body.framework_selections.length > 0) {
      const records = body.framework_selections.map((sel) => ({
        id: uuidv4(),
        organization_id: body.organization_id!,
        framework_id: sel.framework_id || null,
        framework_version_id: sel.framework_version_id || null,
        framework_name: sel.framework_name || null,
        framework_version_name: sel.framework_version_name || null,
        selected_control_ids: sel.control_ids || null,
        risk_threshold: sel.risk_threshold || 'medium',
        is_stub_data: !sel.framework_id,
        created_by: _ctx.internalUser.id,
      }))

      await OrganizationFrameworkSelection.bulkCreate(records, { transaction: t })
    }

    await t.commit()

    const selections = await OrganizationFrameworkSelection.findAll({
      where: { organization_id: body.organization_id },
      order: [['created_at', 'ASC']],
    })

    return NextResponse.json({
      step: 5,
      framework_selections: selections.map((s) => ({
        id: s.id,
        framework_id: s.framework_id,
        framework_version_id: s.framework_version_id,
        framework_name: s.framework_name,
        framework_version_name: s.framework_version_name,
        control_ids: s.selected_control_ids,
        risk_threshold: s.risk_threshold,
        is_stub_data: s.is_stub_data,
      })),
    })
  } catch (err) {
    await t.rollback()
    console.error('[WIZARD] Error saving framework selections:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to save framework selections.' },
      { status: 500 },
    )
  }
}

export const GET = requirePermission('onboarding', 'read')(getHandler)
export const POST = requirePermission('onboarding', 'create')(postHandler)
