import { NextRequest, NextResponse } from 'next/server'
import { canScheduleDemo } from '@/lib/gate-service'
import { getAuthUser } from '@/lib/auth'

const ALLOWED_ROLES = ['Super Admin', 'Implementation Manager']

export async function POST(request: NextRequest): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  if (!ALLOWED_ROLES.includes(authUser.roleName ?? '')) {
    return NextResponse.json({ error: 'forbidden', message: 'Insufficient permissions' }, { status: 403 })
  }

  let body: { organization_id?: string; override_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request', message: 'Invalid request body.' }, { status: 400 })
  }

  if (!body.organization_id || typeof body.organization_id !== 'string') {
    return NextResponse.json({ error: 'validation_error', message: 'organization_id is required' }, { status: 400 })
  }

  try {
    const result = await canScheduleDemo(body.organization_id, body.override_id || undefined)
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[GATES] check-demo error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to check demo gate' }, { status: 500 })
  }
}
