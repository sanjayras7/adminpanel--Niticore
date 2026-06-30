import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MUTATING_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE']

export async function middleware(request: NextRequest) {
  if (!MUTATING_METHODS.includes(request.method)) {
    return NextResponse.next()
  }

  const { pathname, origin } = request.nextUrl

  if (pathname.startsWith('/api/v1/internal/impersonation/')) {
    return NextResponse.next()
  }

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const userId = request.headers.get('x-internal-user-id')
  if (!userId) {
    return NextResponse.next()
  }

  try {
    const url = new URL('/api/v1/internal/impersonation/session-check', origin)
    const res = await fetch(url.toString(), {
      headers: {
        'x-internal-user-id': userId,
        'x-mw-check': '1',
      },
    })

    if (res.ok) {
      const data: { active: boolean; expires_at?: string } = await res.json()
      if (data.active) {
        return NextResponse.json(
          {
            error: 'IMPERSONATION_READ_ONLY',
            message: 'Mutations are blocked during impersonation',
            session_expires_at: data.expires_at,
          },
          { status: 403 },
        )
      }
    }
  } catch {
    console.error('[IMPERSONATION-MW] Failed to check impersonation status')
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
