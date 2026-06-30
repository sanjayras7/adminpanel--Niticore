import { NextRequest, NextResponse } from 'next/server'
import { InternalSession } from '@/lib/models/InternalSession'
import { getInternalSession, unauthorizedResponse } from '@/lib/internal-auth'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await getInternalSession(request)
  if (!auth) return unauthorizedResponse()

  try {
    await InternalSession.destroy({
      where: { id: auth.sessionId },
    })
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  const response = new NextResponse(null, { status: 204 })
  response.cookies.set('internal_session', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/internal',
    maxAge: 0,
  })

  return response
}
