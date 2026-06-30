import { NextRequest, NextResponse } from 'next/server'
import { getInternalSession, isSessionError } from '@/lib/auth/session'
import { can } from '@/lib/authorization'
import type { InternalRoleName } from '@/lib/permission-matrix'

interface NavEntry {
  label: string
  href: string
  module: string
}

const NAV_ITEMS: NavEntry[] = [
  { label: 'Dashboard',              href: '/internal',                module: 'shell' },
  { label: 'Leads / CRM',            href: '/internal/leads',          module: 'leads' },
  { label: 'Contracts',              href: '/internal/contracts',      module: 'nda-contracts' },
  { label: 'Tenants',                href: '/internal/tenants',        module: 'tenant-ops' },
  { label: 'Provisioning',           href: '/internal/provisioning',   module: 'provisioning-monitoring' },
  { label: 'Support',                href: '/internal/support',        module: 'support-impersonation' },
  { label: 'Frameworks / Controls',  href: '/internal/frameworks',     module: 'framework-controls' },
  { label: 'Risk / Taxonomy',        href: '/internal/risk',           module: 'tenant-framework-config' },
  { label: 'Internal Users / Roles', href: '/internal/internal-users', module: 'rbac' },
  { label: 'Audit Logs',             href: '/internal/audit-logs',     module: 'audit' },
  { label: 'Settings',               href: '/internal/settings',       module: 'auth' },
]

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getInternalSession(request)

  if (isSessionError(session)) {
    return NextResponse.json(
      { error: session.error, message: session.message },
      { status: session.status },
    )
  }

  const items = NAV_ITEMS.filter((item) =>
    can(session.roleName as InternalRoleName, item.module, 'read'),
  )

  return NextResponse.json({ items })
}
