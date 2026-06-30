import { NextRequest, NextResponse } from 'next/server'
import { sequelize } from '@/lib/sequelize'
import { getInternalSession, unauthorizedResponse } from '@/lib/internal-auth'
import { QueryTypes } from 'sequelize'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await getInternalSession(request)
  if (!auth) return unauthorizedResponse()

  try {
    const [user] = await sequelize.query<{
      id: string
      name: string
      surname: string
      email: string
      role: string | null
      last_login_at: string | null
      totp_enabled: boolean
    }>(
      `SELECT u.id, u.name, u.surname, u.email, u.last_login_at, u.totp_enabled,
              r.name AS role
       FROM internal_users u
       LEFT JOIN internal_roles r ON r.id = u.internal_role_id
       WHERE u.id = :id AND u.deleted_at IS NULL`,
      {
        replacements: { id: auth.internalUserId },
        type: QueryTypes.SELECT,
      },
    )

    if (!user) return unauthorizedResponse()

    return NextResponse.json({
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      role: user.role,
      last_login_at: user.last_login_at,
      totp_enabled: user.totp_enabled,
    })
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }
}
