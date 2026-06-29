import { NextRequest, NextResponse } from 'next/server'
import { WizardState } from '@/lib/models'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')

  if (!leadId) {
    return NextResponse.json({ error: 'invalid_request', message: 'leadId query parameter is required.' }, { status: 400 })
  }

  try {
    const state = await WizardState.findOne({
      where: { lead_id: leadId, deleted_at: null },
      order: [['created_at', 'DESC']],
    })

    if (!state) {
      return NextResponse.json({ error: 'not_found', message: 'No wizard state found for this lead.' }, { status: 404 })
    }

    const completedSteps: string[] = state.completed_steps || []
    const stepData = state.step_data || {}
    const warnings: string[] = []

    if (!completedSteps.includes('organization')) {
      warnings.push('Organization step not completed')
    }
    if (!completedSteps.includes('modules')) {
      warnings.push('Module selection step not completed')
    }
    if (!completedSteps.includes('admin')) {
      warnings.push('Admin invite step not completed')
    }

    const organization = stepData.organization as Record<string, unknown> | undefined
    const selectedModules = (stepData.modules as Array<Record<string, unknown>>) || []
    const selectedFrameworks = (stepData.frameworks as string[]) || []
    const adminInvite = stepData.adminInvite as Record<string, unknown> | null | undefined

    return NextResponse.json({
      organization: organization || null,
      selectedModules,
      selectedFrameworks,
      adminInvite: adminInvite ? {
        invited: adminInvite.invited ?? false,
        email: adminInvite.email || null,
        status: adminInvite.status || 'pending',
      } : null,
      contractGate: {
        status: 'not_signed',
        documentRef: null,
        overriddenBy: null,
      },
      warnings,
    })
  } catch (err) {
    console.error('[ONBOARDING] Review error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to load review data.' }, { status: 500 })
  }
}
