import { permissionMatrix, ALL_ROLE_NAMES, type InternalRoleName, type ModuleName, type ActionName } from './permission-matrix'

export function can(role: InternalRoleName, module: ModuleName, action: ActionName): boolean {
  if (!ALL_ROLE_NAMES.includes(role as any)) {
    console.warn(`[AUTHORIZATION] Unknown role: "${String(role)}" — denying access`)
    return false
  }

  const moduleEntry = permissionMatrix[module]
  if (!moduleEntry) {
    console.warn(`[AUTHORIZATION] Unknown module: "${module}" — denying access`)
    return false
  }

  const allowedRoles = moduleEntry[action]
  if (!allowedRoles) {
    console.warn(`[AUTHORIZATION] Unknown action "${action}" for module "${module}" — denying access`)
    return false
  }

  return allowedRoles.includes(role)
}
