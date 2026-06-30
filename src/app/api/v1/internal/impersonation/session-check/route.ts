import { NextRequest, NextResponse } from 'next/server'
import { getActiveImpersonationSession } from '@/lib/middleware/impersonation'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-internal-user-id')
  if (!userId) {
    return NextResponse.json({ active: false })
  }

  try {
    const session = await getActiveImpersonationSession(userId)
    if (session) {
      return NextResponse.json({
        active: true,
        expires_at: session.expires_at.toISOString(),
        organization_id: session.organization_id,
        impersonated_user_id: session.impersonated_user_id,
      })
    }

    return NextResponse.json({ active: false })
  } catch (err) {
    console.error('[IMPERSONATION] Session check error:', err)
    return NextResponse.json({ active: false })
  }
}
