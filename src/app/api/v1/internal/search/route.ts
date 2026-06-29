import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/requirePermission'
import { searchAll } from '@/lib/search'
import type { InternalSessionUser } from '@/lib/auth/session'

export const GET = requirePermission('shell', 'read')(async (req: NextRequest, ctx: { internalUser: InternalSessionUser }) => {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ results: [], total: 0 })
  }

  if (q.trim().length > 200) {
    return NextResponse.json(
      { error: 'invalid_query', message: 'Search query must be 200 characters or fewer.' },
      { status: 400 },
    )
  }

  try {
    const result = await searchAll(q.trim(), {
      userId: ctx.internalUser.id,
      roleName: ctx.internalUser.roleName,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[Search API] searchAll failed:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Search failed. Please try again.' },
      { status: 500 },
    )
  }
})
