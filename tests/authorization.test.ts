import { can } from '@/lib/authorization'
import { permissionMatrix, type InternalRoleName, type ModuleName, type ActionName } from '@/lib/permission-matrix'

type TestCase = {
  role: InternalRoleName
  module: ModuleName
  action: ActionName
  expected: boolean
  label: string
}

const ALL_MODULES: ModuleName[] = [
  'auth', 'rbac', 'shell', 'leads', 'nda-contracts', 'e-sign',
  'document-storage', 'onboarding', 'provisioning-monitoring', 'tenant-ops',
  'support-impersonation', 'framework-controls', 'tenant-framework-config',
  'audit', 'notifications',
]

const ALL_ACTIONS: ActionName[] = ['create', 'read', 'update', 'delete', 'override', 'impersonate', 'audit']

function buildCases(): TestCase[] {
  const cases: TestCase[] = []
  for (const module of ALL_MODULES) {
    for (const action of ALL_ACTIONS) {
      const allowed = permissionMatrix[module]?.[action] ?? []
      for (const role of ['Super Admin', 'Implementation Manager', 'Customer Success', 'Support', 'Finance/Admin', 'Engineering', 'Read-only Auditor'] as InternalRoleName[]) {
        const expected = allowed.includes(role)
        cases.push({
          role,
          module,
          action,
          expected,
          label: `${role} | ${module} | ${action} → ${expected ? 'ALLOW' : 'DENY'}`,
        })
      }
    }
  }
  return cases
}

const ALL_CASES = buildCases()

describe('can() — authorization helper', () => {
  describe('Super Admin', () => {
    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Super Admin' && c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Super Admin', module, action)).toBe(true)
    })

    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Super Admin' && !c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Super Admin', module, action)).toBe(false)
    })
  })

  describe('Implementation Manager', () => {
    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Implementation Manager' && c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Implementation Manager', module, action)).toBe(true)
    })

    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Implementation Manager' && !c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Implementation Manager', module, action)).toBe(false)
    })
  })

  describe('Customer Success', () => {
    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Customer Success' && c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Customer Success', module, action)).toBe(true)
    })

    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Customer Success' && !c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Customer Success', module, action)).toBe(false)
    })
  })

  describe('Support', () => {
    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Support' && c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Support', module, action)).toBe(true)
    })

    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Support' && !c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Support', module, action)).toBe(false)
    })
  })

  describe('Finance/Admin', () => {
    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Finance/Admin' && c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Finance/Admin', module, action)).toBe(true)
    })

    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Finance/Admin' && !c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Finance/Admin', module, action)).toBe(false)
    })
  })

  describe('Engineering', () => {
    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Engineering' && c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Engineering', module, action)).toBe(true)
    })

    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Engineering' && !c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Engineering', module, action)).toBe(false)
    })
  })

  describe('Read-only Auditor', () => {
    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Read-only Auditor' && c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Read-only Auditor', module, action)).toBe(true)
    })

    it.each(
      ALL_CASES
        .filter((c) => c.role === 'Read-only Auditor' && !c.expected)
        .map((c) => [c.label, c.module, c.action] as const),
    )('$s', (_label, module, action) => {
      expect(can('Read-only Auditor', module, action)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns false for unknown module', () => {
      expect(can('Super Admin', 'unknown-module' as ModuleName, 'read')).toBe(false)
    })

    it('returns false for unknown action', () => {
      expect(can('Super Admin', 'auth', 'unknown-action' as ActionName)).toBe(false)
    })

    it('returns false when role is valid but not in the allowed list for that action', () => {
      expect(can('Super Admin', 'shell', 'create')).toBe(false)
    })

    it('returns false for non-existent module', () => {
      expect(can('Support', 'billing' as ModuleName, 'read')).toBe(false)
    })

    it('returns false for non-existent action', () => {
      expect(can('Implementation Manager', 'auth', 'export' as ActionName)).toBe(false)
    })

    it('returns false for a truly unknown role name (not in the type)', () => {
      expect(can('Fake Role' as InternalRoleName, 'auth', 'read')).toBe(false)
    })
  })
})

describe('permission matrix completeness', () => {
  it('every module has an entry for every action', () => {
    for (const module of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        expect(permissionMatrix[module]).toBeDefined()
        expect(permissionMatrix[module][action]).toBeDefined()
      }
    }
  })

  it('all roles referenced in the matrix are valid', () => {
    const validRoles: InternalRoleName[] = [
      'Super Admin', 'Implementation Manager', 'Customer Success', 'Support',
      'Finance/Admin', 'Engineering', 'Read-only Auditor',
    ]
    for (const module of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        const allowed = permissionMatrix[module][action] ?? []
        for (const role of allowed) {
          expect(validRoles).toContain(role)
        }
      }
    }
  })
})

describe('can() — representative role/action pairs (design doc traceability)', () => {
  it.each([
    { role: 'Super Admin' as const, module: 'auth' as const, action: 'create' as const, expected: true },
    { role: 'Super Admin' as const, module: 'auth' as const, action: 'override' as const, expected: true },
    { role: 'Super Admin' as const, module: 'support-impersonation' as const, action: 'impersonate' as const, expected: true },

    { role: 'Implementation Manager' as const, module: 'leads' as const, action: 'read' as const, expected: true },
    { role: 'Implementation Manager' as const, module: 'leads' as const, action: 'create' as const, expected: true },
    { role: 'Implementation Manager' as const, module: 'onboarding' as const, action: 'update' as const, expected: true },
    { role: 'Implementation Manager' as const, module: 'support-impersonation' as const, action: 'impersonate' as const, expected: false },

    { role: 'Customer Success' as const, module: 'leads' as const, action: 'read' as const, expected: true },
    { role: 'Customer Success' as const, module: 'leads' as const, action: 'create' as const, expected: true },
    { role: 'Customer Success' as const, module: 'nda-contracts' as const, action: 'create' as const, expected: false },
    { role: 'Customer Success' as const, module: 'auth' as const, action: 'delete' as const, expected: false },

    { role: 'Support' as const, module: 'support-impersonation' as const, action: 'impersonate' as const, expected: true },
    { role: 'Support' as const, module: 'support-impersonation' as const, action: 'read' as const, expected: true },
    { role: 'Support' as const, module: 'auth' as const, action: 'read' as const, expected: true },
    { role: 'Support' as const, module: 'auth' as const, action: 'update' as const, expected: true },
    { role: 'Support' as const, module: 'provisioning-monitoring' as const, action: 'update' as const, expected: false },

    { role: 'Finance/Admin' as const, module: 'tenant-ops' as const, action: 'read' as const, expected: true },
    { role: 'Finance/Admin' as const, module: 'tenant-ops' as const, action: 'update' as const, expected: false },
    { role: 'Finance/Admin' as const, module: 'nda-contracts' as const, action: 'read' as const, expected: true },
    { role: 'Finance/Admin' as const, module: 'audit' as const, action: 'read' as const, expected: true },
    { role: 'Finance/Admin' as const, module: 'framework-controls' as const, action: 'read' as const, expected: false },

    { role: 'Engineering' as const, module: 'provisioning-monitoring' as const, action: 'read' as const, expected: true },
    { role: 'Engineering' as const, module: 'provisioning-monitoring' as const, action: 'create' as const, expected: true },
    { role: 'Engineering' as const, module: 'onboarding' as const, action: 'read' as const, expected: true },
    { role: 'Engineering' as const, module: 'nda-contracts' as const, action: 'read' as const, expected: false },
    { role: 'Engineering' as const, module: 'auth' as const, action: 'update' as const, expected: false },

    { role: 'Read-only Auditor' as const, module: 'auth' as const, action: 'read' as const, expected: true },
    { role: 'Read-only Auditor' as const, module: 'auth' as const, action: 'audit' as const, expected: true },
    { role: 'Read-only Auditor' as const, module: 'auth' as const, action: 'update' as const, expected: false },
    { role: 'Read-only Auditor' as const, module: 'auth' as const, action: 'impersonate' as const, expected: false },
    { role: 'Read-only Auditor' as const, module: 'support-impersonation' as const, action: 'impersonate' as const, expected: false },
  ])('$role can($role, $module, $action) === $expected', ({ role, module, action, expected }) => {
    expect(can(role, module, action)).toBe(expected)
  })
})

describe('role semantics per design doc', () => {
  it('Super Admin can do everything — no module/action denied unless empty', () => {
    for (const module of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        const allowed = permissionMatrix[module]?.[action] ?? []
        if (allowed.length === 0) {
          expect(can('Super Admin', module, action)).toBe(false)
        } else {
          expect(can('Super Admin', module, action)).toBe(true)
        }
      }
    }
  })

  it('Read-only Auditor can read and audit everything, create audit events, but never update/delete/override/impersonate', () => {
    for (const module of ALL_MODULES) {
      for (const action of ALL_ACTIONS) {
        const allowed = permissionMatrix[module]?.[action] ?? []
        if (action === 'read' || action === 'audit') {
          expect(allowed).toContain('Read-only Auditor')
        } else if (action === 'create' && module === 'audit') {
          expect(allowed).toContain('Read-only Auditor')
        } else {
          expect(allowed).not.toContain('Read-only Auditor')
        }
      }
    }
  })

  it('Finance/Admin has only read access, never create/update/delete/override/impersonate', () => {
    for (const module of ALL_MODULES) {
      for (const action of ['create', 'update', 'delete', 'override', 'impersonate'] as ActionName[]) {
        expect(can('Finance/Admin', module, action)).toBe(false)
      }
    }
  })

  it('Support has impersonate on support-impersonation module', () => {
    expect(can('Support', 'support-impersonation', 'impersonate')).toBe(true)
    expect(can('Support', 'support-impersonation', 'read')).toBe(true)
  })

  it('only Super Admin can override', () => {
    for (const module of ALL_MODULES) {
      const allowed = permissionMatrix[module]?.override ?? []
      if (allowed.length > 0) {
        expect(allowed).toEqual(['Super Admin'])
      }
    }
  })
})
