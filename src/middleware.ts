import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'internal_session'
const SESSION_TOKEN_RE = /^[0-9a-f]{64}$/i

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value

  if (!sessionCookie || !SESSION_TOKEN_RE.test(sessionCookie)) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/internal/:path*', '/internal'],
}
