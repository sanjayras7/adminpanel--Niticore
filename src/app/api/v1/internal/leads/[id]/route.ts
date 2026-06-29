import { NextRequest, NextResponse } from 'next/server'
import { Lead } from '@/lib/models'
import { getInternalSession, isSessionError } from '@/lib/auth/session'
import { can } from '@/lib/authorization'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await getInternalSession(request)
  if (isSessionError(session)) {
    return NextResponse.json(
      { error: session.error, message: session.message },
      { status: session.status },
    )
  }

  if (!can(session.roleName, 'leads', 'read')) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Insufficient permissions' },
      { status: 403 },
    )
  }

  try {
    const lead = await Lead.findByPk(params.id)

    if (!lead) {
      return NextResponse.json({ error: 'not_found', message: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json(lead)
  } catch (err) {
    console.error('[LEADS] Failed to fetch lead:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred' },
      { status: 500 },
    )
  }
}
