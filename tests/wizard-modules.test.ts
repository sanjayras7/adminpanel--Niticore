import { validateModulesBody } from '@/lib/validation'
import { getModules, getModuleIds, getPlanDefaultModuleIds } from '@/lib/services/module-service'

describe('POST /api/v1/internal/onboarding/wizard/modules', () => {
  describe('module service stub', () => {
    it('returns 15 modules', () => {
      const modules = getModules()
      expect(modules).toHaveLength(15)
    })

    it('each module has id, name, description, key', () => {
      const modules = getModules()
      for (const mod of modules) {
        expect(mod.id).toBeTruthy()
        expect(mod.name).toBeTruthy()
        expect(mod.description).toBeTruthy()
        expect(mod.key).toBeTruthy()
      }
    })

    it('getModuleIds returns all module IDs', () => {
      const ids = getModuleIds()
      expect(ids).toHaveLength(15)
      const modules = getModules()
      for (const mod of modules) {
        expect(ids).toContain(mod.id)
      }
    })

    it('getPlanDefaultModuleIds returns all module IDs (all enabled by default)', () => {
      const defaults = getPlanDefaultModuleIds()
      expect(defaults).toHaveLength(15)
      expect(defaults).toEqual(getModuleIds())
    })

    it('getModuleById returns a module by id', () => {
      const { getModuleById } = require('@/lib/services/module-service')
      const mod = getModuleById('mod-auth-mfa')
      expect(mod).toBeDefined()
      expect(mod!.name).toBe('Auth + MFA')
    })

    it('getModuleById returns undefined for unknown id', () => {
      const { getModuleById } = require('@/lib/services/module-service')
      const mod = getModuleById('non-existent')
      expect(mod).toBeUndefined()
    })
  })

  describe('validation - validateModulesBody', () => {
    const validModuleIds = getModuleIds()

    const validBody = {
      organization_id: 'org-123',
      modules: [
        { module_id: validModuleIds[0], enabled: true },
        { module_id: validModuleIds[1], enabled: false },
      ],
    }

    it('passes validation with valid body', () => {
      const errors = validateModulesBody(validBody)
      expect(Object.keys(errors)).toHaveLength(0)
    })

    it('rejects missing organization_id', () => {
      const { organization_id, ...body } = validBody
      const errors = validateModulesBody(body)
      expect(errors.organization_id).toBe('required')
    })

    it('rejects missing modules array', () => {
      const { modules, ...body } = validBody
      const errors = validateModulesBody(body)
      expect(errors.modules).toBe('required')
    })

    it('rejects empty modules array', () => {
      const errors = validateModulesBody({ ...validBody, modules: [] })
      expect(errors.modules).toBe('required')
    })

    it('rejects unknown module IDs', () => {
      const errors = validateModulesBody({
        ...validBody,
        modules: [
          { module_id: 'unknown-module', enabled: true },
        ],
      })
      expect(errors.modules).toBe('unknown_module_ids')
    })

    it('rejects when no modules are enabled', () => {
      const errors = validateModulesBody({
        ...validBody,
        modules: [
          { module_id: validModuleIds[0], enabled: false },
          { module_id: validModuleIds[1], enabled: false },
        ],
      })
      expect(errors.modules).toBe('at_least_one_enabled')
    })

    it('passes with all modules enabled', () => {
      const allEnabled = validModuleIds.map(id => ({
        module_id: id,
        enabled: true,
      }))
      const errors = validateModulesBody({
        organization_id: 'org-1',
        modules: allEnabled,
      })
      expect(Object.keys(errors)).toHaveLength(0)
    })

    it('passes with mixed enabled/disabled modules as long as at least one is enabled', () => {
      const mixedModules = validModuleIds.map((id, i) => ({
        module_id: id,
        enabled: i === 0,
      }))
      const errors = validateModulesBody({
        organization_id: 'org-1',
        modules: mixedModules,
      })
      expect(Object.keys(errors)).toHaveLength(0)
    })
  })
})
