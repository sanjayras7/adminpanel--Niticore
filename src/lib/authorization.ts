import { permissionMatrix, type InternalRoleName, type ModuleName, type ActionName } from './permission-matrix'

export function can(role: InternalRoleName, module: ModuleName, action: ActionName): boolean {
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
