import { NextRequest, NextResponse } from 'next/server'
import { sequelize } from '@/lib/sequelize'
import { getAuthUser, AuthError } from '@/lib/auth'
import { getActiveImpersonationSession } from '@/lib/middleware/impersonation'

export async function GET(request: NextRequest): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
  } catch (err: unknown) {
    const status = err instanceof AuthError ? err.statusCode : 401
    return NextResponse.json(
      { error: 'unauthorized', message: err instanceof Error ? err.message : 'Authentication required' },
      { status },
    )
  }

  let session
  try {
    session = await getActiveImpersonationSession(authUser.id)
  } catch {
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to check impersonation status' },
      { status: 500 },
    )
  }

  if (!session) {
    return NextResponse.json({ data: null })
  }

  let organizationName: string | null = null
  try {
    const [rows] = await sequelize.query(
      'SELECT name FROM organizations WHERE id = :id LIMIT 1',
      { replacements: { id: session.organization_id } },
    )
    const orgRow = rows as { name?: string }[]
    if (orgRow.length > 0 && orgRow[0].name) {
      organizationName = orgRow[0].name
    }
  } catch {
    console.error('[IMPERSONATION] Failed to look up organization name:', session.organization_id)
  }

  return NextResponse.json({
    data: {
      id: session.id,
      actor_internal_user_id: session.actor_internal_user_id,
      organization_id: session.organization_id,
      organization_name: organizationName,
      impersonated_user_id: session.impersonated_user_id,
      reason: session.reason,
      started_at: session.started_at.toISOString(),
      expires_at: session.expires_at.toISOString(),
      status: session.status,
    },
  })
}
