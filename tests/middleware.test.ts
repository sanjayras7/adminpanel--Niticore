/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

function mockRequest(url: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) {
    headers.cookie = cookie
  }
  return new NextRequest(url, { headers })
}

beforeEach(() => {
  jest.resetModules()
})

describe('middleware', () => {
  describe('matcher', () => {
    it('matches /internal paths', async () => {
      const { config } = await import('@/middleware')
      expect(config.matcher).toEqual(['/internal/:path*', '/internal'])
    })
  })

  describe('session cookie check', () => {
    it('redirects to /auth/login when no session cookie', async () => {
      const { middleware } = await import('@/middleware')
      const req = mockRequest('http://localhost/internal/dashboard')
      const res = await middleware(req)

      expect(res.status).toBe(307)
      const location = res.headers.get('location') || ''
      expect(location).toContain('/auth/login')
    })

    it('redirects to /auth/login when session cookie has invalid format', async () => {
      const { middleware } = await import('@/middleware')
      const req = mockRequest('http://localhost/internal/leads', 'internal_session=invalid-format')
      const res = await middleware(req)

      expect(res.status).toBe(307)
      const location = res.headers.get('location') || ''
      expect(location).toContain('/auth/login')
    })

    it('allows request through with valid session cookie', async () => {
      const { middleware } = await import('@/middleware')
      const validToken = 'a'.repeat(64)
      const req = mockRequest('http://localhost/internal/contracts', `internal_session=${validToken}`)
      const res = await middleware(req)

      expect(res.status).toBe(200)
    })

    it('redirect preserves the original path as redirect param', async () => {
      const { middleware } = await import('@/middleware')
      const req = mockRequest('http://localhost/internal/settings')
      const res = await middleware(req)

      const location = res.headers.get('location') || ''
      expect(location).toContain('redirect=%2Finternal%2Fsettings')
    })

    it('allows request through for root /internal path', async () => {
      const { middleware } = await import('@/middleware')
      const validToken = 'b'.repeat(64)
      const req = mockRequest('http://localhost/internal', `internal_session=${validToken}`)
      const res = await middleware(req)

      expect(res.status).toBe(200)
    })

    it('redirects to /auth/login for root /internal path when no cookie', async () => {
      const { middleware } = await import('@/middleware')
      const req = mockRequest('http://localhost/internal')
      const res = await middleware(req)

      expect(res.status).toBe(307)
      const location = res.headers.get('location') || ''
      expect(location).toContain('/auth/login')
    })
  })
})
