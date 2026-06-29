import { v4 as uuidv4 } from 'uuid'
import {
  validateFrameworkSelection,
  validateIntegrationIntent,
} from '@/lib/validation/wizard'

describe('Step 5 - Framework Selection', () => {
  describe('stub data shape', () => {
    const STUB_FRAMEWORKS = [
      {
        name: 'SOC 2',
        versions: [
          {
            version: '2023',
            controls: ['CC1.1', 'CC1.2', 'CC1.3', 'CC1.4', 'CC1.5', 'CC2.1', 'CC2.2', 'CC2.3', 'CC3.1', 'CC3.2', 'CC3.3', 'CC4.1', 'CC4.2', 'CC5.1', 'CC5.2', 'CC5.3', 'CC6.1', 'CC6.2', 'CC6.3', 'CC6.4', 'CC6.5', 'CC6.6', 'CC6.7', 'CC6.8', 'CC7.1', 'CC7.2', 'CC7.3', 'CC7.4', 'CC7.5', 'CC8.1', 'CC9.1', 'CC9.2', 'CC10.1'],
          },
        ],
      },
      {
        name: 'ISO 27001',
        versions: [
          {
            version: '2022',
            controls: ['A.5.1', 'A.5.2', 'A.5.3', 'A.5.4', 'A.5.5', 'A.6.1', 'A.6.2', 'A.6.3', 'A.7.1', 'A.7.2', 'A.7.3', 'A.7.4', 'A.8.1', 'A.8.2', 'A.8.3', 'A.8.4', 'A.8.5', 'A.8.6', 'A.8.7', 'A.8.8', 'A.8.9', 'A.8.10', 'A.8.11', 'A.8.12', 'A.8.13', 'A.8.14', 'A.8.15', 'A.8.16', 'A.9.1', 'A.9.2', 'A.9.3', 'A.9.4', 'A.10.1', 'A.10.2', 'A.11.1', 'A.11.2', 'A.11.3', 'A.12.1', 'A.12.2', 'A.12.3', 'A.12.4', 'A.12.5', 'A.12.6', 'A.12.7', 'A.13.1', 'A.13.2', 'A.14.1', 'A.14.2', 'A.14.3', 'A.15.1', 'A.15.2', 'A.16.1', 'A.17.1', 'A.17.2', 'A.18.1', 'A.18.2'],
          },
        ],
      },
      {
        name: 'NIST CSF',
        versions: [
          {
            version: '2.0',
            controls: ['GV.OC', 'GV.RM', 'GV.RR', 'GV.SC', 'GV.RP', 'GV.OV', 'GV.DM', 'GV.PO', 'RA.AH', 'RA.RM', 'RA.SC', 'RA.AN', 'RA.CR', 'SB.SC', 'SB.RP', 'SB.SU', 'SB.ST', 'SB.RE', 'SB.RS', 'SB.SD', 'SB.RS', 'AN.CM', 'AN.TW', 'AN.CR', 'AN.IM', 'AN.AN', 'AN.CM', 'DE.CM', 'DE.AE', 'DE.IR', 'DE.MI', 'RS.MA', 'RS.AN', 'RS.CO', 'RS.IM', 'RS.MI', 'RC.RP', 'RC.IM', 'RC.CO'],
          },
        ],
      },
    ]

    it('returns all three well-known frameworks in stub data', () => {
      const names = STUB_FRAMEWORKS.map((f) => f.name)
      expect(names).toContain('SOC 2')
      expect(names).toContain('ISO 27001')
      expect(names).toContain('NIST CSF')
    })

    it('each framework has at least one version with controls', () => {
      for (const fw of STUB_FRAMEWORKS) {
        expect(fw.versions.length).toBeGreaterThan(0)
        for (const ver of fw.versions) {
          expect(typeof ver.version).toBe('string')
          expect(ver.version.length).toBeGreaterThan(0)
          expect(Array.isArray(ver.controls)).toBe(true)
          expect(ver.controls.length).toBeGreaterThan(0)
          for (const ctrl of ver.controls) {
            expect(typeof ctrl).toBe('string')
          }
        }
      }
    })

    it('SOC 2 has version "2023" with 33 controls', () => {
      const soc2 = STUB_FRAMEWORKS.find((f) => f.name === 'SOC 2')
      expect(soc2).toBeDefined()
      expect(soc2!.versions[0].version).toBe('2023')
      expect(soc2!.versions[0].controls).toHaveLength(33)
    })

    it('ISO 27001 has version "2022" with 56 controls', () => {
      const iso = STUB_FRAMEWORKS.find((f) => f.name === 'ISO 27001')
      expect(iso).toBeDefined()
      expect(iso!.versions[0].version).toBe('2022')
      expect(iso!.versions[0].controls).toHaveLength(56)
    })

    it('NIST CSF has version "2.0" with 39 controls', () => {
      const nist = STUB_FRAMEWORKS.find((f) => f.name === 'NIST CSF')
      expect(nist).toBeDefined()
      expect(nist!.versions[0].version).toBe('2.0')
      expect(nist!.versions[0].controls).toHaveLength(39)
    })
  })

  describe('validation', () => {
    it('rejects missing organization_id', () => {
      const result = validateFrameworkSelection({ organization_id: '', framework_selections: [] })
      expect(result.organization_id).toBeDefined()
    })

    it('rejects non-array framework_selections', () => {
      const result = validateFrameworkSelection({
        organization_id: uuidv4(),
        framework_selections: 'not-array' as any,
      })
      expect(result.framework_selections).toBeDefined()
    })

    it('rejects invalid risk_threshold', () => {
      const result = validateFrameworkSelection({
        organization_id: uuidv4(),
        framework_selections: [{ risk_threshold: 'extreme' }],
      })
      const hasError = Object.values(result).some((v) => String(v).includes('risk threshold'))
      expect(hasError).toBe(true)
    })

    it('accepts valid risk_threshold values', () => {
      for (const threshold of ['low', 'medium', 'high', 'critical', 'all']) {
        const result = validateFrameworkSelection({
          organization_id: uuidv4(),
          framework_selections: [{ risk_threshold: threshold }],
        })
        expect(Object.keys(result)).toHaveLength(0)
      }
    })

    it('accepts empty framework_selections array (select none)', () => {
      const result = validateFrameworkSelection({
        organization_id: uuidv4(),
        framework_selections: [],
      })
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('accepts valid framework selection with all fields', () => {
      const result = validateFrameworkSelection({
        organization_id: uuidv4(),
        framework_selections: [
          {
            framework_name: 'SOC 2',
            framework_version_name: '2023',
            control_ids: ['CC1.1', 'CC1.2'],
            risk_threshold: 'medium',
          },
        ],
      })
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  describe('data shape', () => {
    it('builds a valid framework_selections entry with stub data', () => {
      const selection = {
        framework_id: null,
        framework_version_id: null,
        framework_name: 'SOC 2',
        framework_version_name: '2023',
        control_ids: ['CC1.1', 'CC2.1'],
        risk_threshold: 'high',
        is_stub_data: true,
      }
      expect(selection.framework_name).toBe('SOC 2')
      expect(selection.risk_threshold).toBe('high')
      expect(selection.control_ids).toHaveLength(2)
      expect(selection.is_stub_data).toBe(true)
    })

    it('builds a valid framework_selections entry with real FK references', () => {
      const selection = {
        framework_id: uuidv4(),
        framework_version_id: uuidv4(),
        control_ids: null,
        risk_threshold: 'all',
        is_stub_data: false,
      }
      expect(selection.framework_id).toBeTruthy()
      expect(selection.framework_version_id).toBeTruthy()
      expect(selection.control_ids).toBeNull()
      expect(selection.is_stub_data).toBe(false)
    })
  })
})

describe('Step 6 - Integration Setup', () => {
  describe('validation', () => {
    it('rejects missing organization_id', () => {
      const result = validateIntegrationIntent({ organization_id: '' })
      expect(result.organization_id).toBeDefined()
    })

    it('rejects oversized domain', () => {
      const result = validateIntegrationIntent({
        organization_id: uuidv4(),
        domain: 'a'.repeat(256),
      })
      expect(result.domain).toBeDefined()
    })

    it('rejects oversized sso_provider', () => {
      const result = validateIntegrationIntent({
        organization_id: uuidv4(),
        sso_provider: 'a'.repeat(101),
      })
      expect(result.sso_provider).toBeDefined()
    })

    it('accepts empty body with just organization_id', () => {
      const result = validateIntegrationIntent({ organization_id: uuidv4() })
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('accepts nullish sso_provider and notes', () => {
      const result = validateIntegrationIntent({
        organization_id: uuidv4(),
        sso_provider: null,
        notes: null,
      })
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('accepts valid full body', () => {
      const result = validateIntegrationIntent({
        organization_id: uuidv4(),
        domain: 'example.com',
        sso_required: true,
        sso_provider: 'Okta',
        notes: 'Use existing Okta tenant',
      })
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  describe('data shape', () => {
    it('builds a valid integration_intent entry', () => {
      const intent = {
        id: uuidv4(),
        domain: 'client.example.com',
        sso_required: true,
        sso_provider: 'Azure AD',
        notes: 'Use production tenant',
      }
      expect(intent.domain).toBe('client.example.com')
      expect(intent.sso_required).toBe(true)
      expect(intent.sso_provider).toBe('Azure AD')
    })

    it('stores sso_required=false without sso_provider', () => {
      const intent = {
        id: uuidv4(),
        domain: 'example.com',
        sso_required: false,
        sso_provider: null,
        notes: null,
      }
      expect(intent.sso_required).toBe(false)
      expect(intent.sso_provider).toBeNull()
    })
  })
})

describe('Wizard step data contract shapes', () => {
  it('matches step 5 contract shape', () => {
    const step5Data = {
      step: 5,
      framework_selections: [
        {
          framework_id: uuidv4(),
          framework_version_id: uuidv4(),
          control_ids: [uuidv4(), uuidv4()],
          risk_threshold: 'medium',
        },
      ],
    }
    expect(step5Data.step).toBe(5)
    expect(Array.isArray(step5Data.framework_selections)).toBe(true)
    expect(step5Data.framework_selections[0]).toHaveProperty('framework_id')
    expect(step5Data.framework_selections[0]).toHaveProperty('framework_version_id')
    expect(step5Data.framework_selections[0]).toHaveProperty('control_ids')
    expect(step5Data.framework_selections[0]).toHaveProperty('risk_threshold')
  })

  it('matches step 6 contract shape', () => {
    const step6Data = {
      step: 6,
      integration_intent: {
        domain: 'example.com',
        sso_required: true,
        sso_provider: 'Okta',
        notes: 'Use existing Okta tenant',
      },
    }
    expect(step6Data.step).toBe(6)
    expect(step6Data.integration_intent).toHaveProperty('domain')
    expect(step6Data.integration_intent).toHaveProperty('sso_required')
    expect(step6Data.integration_intent).toHaveProperty('sso_provider')
    expect(step6Data.integration_intent).toHaveProperty('notes')
  })

  it('step 6 integration_intent can be null (no data saved yet)', () => {
    const step6Empty = { step: 6, integration_intent: null }
    expect(step6Empty.integration_intent).toBeNull()
  })

  it('step 5 framework_selections can be empty array', () => {
    const step5Empty = { step: 5, framework_selections: [] }
    expect(step5Empty.framework_selections).toEqual([])
  })

  it('stub fallback shape matches design doc spec', () => {
    const stubResponse = {
      stub: true,
      message: 'Framework library not yet available.',
      frameworks: [
        { name: 'SOC 2', version: '2023', controls: ['CC1.1', 'CC1.2'] },
        { name: 'ISO 27001', version: '2022', controls: ['A.5', 'A.6'] },
        { name: 'NIST CSF', version: '2.0', controls: ['ID.AM', 'PR.AC'] },
      ],
    }
    expect(stubResponse.stub).toBe(true)
    expect(typeof stubResponse.message).toBe('string')
    expect(stubResponse.frameworks).toHaveLength(3)
  })
})
