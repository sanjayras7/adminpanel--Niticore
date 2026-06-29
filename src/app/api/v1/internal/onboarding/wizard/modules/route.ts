import { NextRequest, NextResponse } from 'next/server'
import { sequelize } from '@/lib/sequelize'
import { authenticateRequest } from '@/lib/auth'
import { validateModulesBody, ModulesRequestBody } from '@/lib/validation'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authUser = await authenticateRequest(request)
  if (!authUser) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Authentication required' },
      { status: 401 },
    )
  }

  // TODO: Add proper role check when Issue 2b (RBAC middleware) is available.
  // Required role: Implementation Manager or Super Admin.

  let body: ModulesRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const validationErrors = validateModulesBody(body)
  if (Object.keys(validationErrors).length > 0) {
    return NextResponse.json(
      { error: 'validation_failed', fields: validationErrors },
      { status: 422 },
    )
  }

  const organizationId = body.organization_id!

  try {
    const values = body.modules!.map(mod => [
      organizationId,
      mod.module_id,
      mod.enabled,
    ])

    await sequelize.query(
      `INSERT INTO organization_module_config (organization_id, module_id, enabled, created_at, updated_at)
       VALUES ${values.map(() => '(?, ?, ?, NOW(), NOW())').join(', ')}
       ON CONFLICT (organization_id, module_id)
       DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
      { replacements: values.flat() },
    )
  } catch {
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to save module configuration' },
      { status: 500 },
    )
  }

  return NextResponse.json(
    {
      updated: true,
      module_count: body.modules!.length,
    },
    { status: 200 },
  )
}
