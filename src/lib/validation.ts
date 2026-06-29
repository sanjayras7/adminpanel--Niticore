import { getModuleIds } from '@/lib/services/module-service'

export interface AdminRequestBody {
  organization_id?: string
  name?: string
  surname?: string
  email?: string
  job_title?: string
  invite_timing?: 'send_now' | 'defer'
}

export interface FieldErrors {
  [field: string]: string
}

export function validateAdminBody(body: AdminRequestBody): FieldErrors {
  const errors: FieldErrors = {}

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.name = 'required'
  }
  if (!body.surname || typeof body.surname !== 'string' || !body.surname.trim()) {
    errors.surname = 'required'
  }
  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.email = 'required'
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email.trim())) {
      errors.email = 'invalid_format'
    }
  }
  if (!body.organization_id || typeof body.organization_id !== 'string') {
    errors.organization_id = 'required'
  }
  if (
    body.invite_timing &&
    body.invite_timing !== 'send_now' &&
    body.invite_timing !== 'defer'
  ) {
    errors.invite_timing = 'invalid_value'
  }

  return errors
}

export interface ModuleSelection {
  module_id: string
  enabled: boolean
}

export interface ModulesRequestBody {
  organization_id?: string
  modules?: ModuleSelection[]
}

export function validateModulesBody(body: ModulesRequestBody): FieldErrors {
  const errors: FieldErrors = {}

  if (!body.organization_id || typeof body.organization_id !== 'string') {
    errors.organization_id = 'required'
  }

  if (!Array.isArray(body.modules) || body.modules.length === 0) {
    errors.modules = 'required'
    return errors
  }

  const validModuleIds = getModuleIds()
  const unknownIds = body.modules.filter(
    m => !validModuleIds.includes(m.module_id),
  )

  if (unknownIds.length > 0) {
    errors.modules = 'unknown_module_ids'
  }

  const enabledCount = body.modules.filter(m => m.enabled).length
  if (enabledCount === 0) {
    errors.modules = 'at_least_one_enabled'
  }

  return errors
}
