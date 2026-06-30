import { NextRequest, NextResponse } from 'next/server'
import { getInternalSession, InternalSessionUser, isSessionError } from '@/lib/auth/session'
import { can } from '@/lib/authorization'
import type { ModuleName, ActionName } from '@/lib/permission-matrix'

type AuthHandler = (
  req: NextRequest,
  ctx: { internalUser: InternalSessionUser },
) => Promise<NextResponse>

export function requirePermission(module: ModuleName, action: ActionName) {
  return function withPermission(handler: AuthHandler) {
    return async function (req: NextRequest): Promise<NextResponse> {
      const session = await getInternalSession(req)

      if (isSessionError(session)) {
        return NextResponse.json(
          { error: session.error, message: session.message },
          { status: session.status },
        )
      }

      if (!can(session.roleName, module, action)) {
        return NextResponse.json(
          { error: 'forbidden', message: 'Insufficient permissions for this action' },
          { status: 403 },
        )
      }

      return handler(req, { internalUser: session })
    }
  }
}
