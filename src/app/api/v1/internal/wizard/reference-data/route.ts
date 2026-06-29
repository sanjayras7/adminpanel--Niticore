import { NextRequest, NextResponse } from 'next/server'
import { InternalUser } from '@/lib/models'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const owners = await InternalUser.findAll({
      where: { status: 'active', deleted_at: null },
      attributes: ['id', 'name', 'surname'],
      order: [['name', 'ASC']],
    })

    const plans = ['starter', 'growth', 'enterprise']
    const lifecycleStatuses = ['draft', 'pending_setup']

    return NextResponse.json({
      owners: owners.map((o) => ({ id: o.id, name: o.name, surname: o.surname })),
      plans,
      lifecycleStatuses,
    })
  } catch (error) {
    console.error('[WIZARD] Reference data error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reference data' },
      { status: 500 }
    )
  }
}