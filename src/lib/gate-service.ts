import { sequelize } from '@/lib/sequelize'

export interface GateCheckResult {
  allowed: boolean
  reason?: string
  gate_type: 'nda' | 'contract'
  document_id?: string
}

const DEMO_GATE = 'nda' as const
const ACTIVATION_GATE = 'contract' as const

export async function canScheduleDemo(
  organizationId: string,
  overrideId?: string,
): Promise<GateCheckResult> {
  const leadResult = await sequelize.query(
    `SELECT id, nda_required FROM leads
     WHERE converted_organization_id = :organizationId AND deleted_at IS NULL
     LIMIT 1`,
    { replacements: { organizationId }, type: 'SELECT' },
  )

  const leadRows = leadResult as Array<{ id: string; nda_required: boolean }>
  const lead = leadRows[0] || null

  if (!lead) {
    return { allowed: false, reason: 'Organization not found', gate_type: DEMO_GATE }
  }

  if (!lead.nda_required) {
    return { allowed: true, gate_type: DEMO_GATE }
  }

  const docResult = await sequelize.query(
    `SELECT id FROM legal_documents
     WHERE (organization_id = :organizationId OR lead_id = :leadId)
       AND document_type = 'nda'
       AND platform_status = 'signed'
       AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    { replacements: { organizationId, leadId: lead.id }, type: 'SELECT' },
  )

  const docRows = docResult as Array<{ id: string }>
  const signedDoc = docRows[0] || null

  if (signedDoc) {
    return { allowed: true, gate_type: DEMO_GATE, document_id: signedDoc.id }
  }

  if (overrideId) {
    const overrideResult = await sequelize.query(
      `SELECT id FROM gate_overrides
       WHERE id = :overrideId
         AND gate_type = 'nda'
         AND (organization_id = :organizationId OR lead_id = :leadId)
       LIMIT 1`,
      { replacements: { overrideId, organizationId, leadId: lead.id }, type: 'SELECT' },
    )

    const overrideRows = overrideResult as Array<{ id: string }>
    const validOverride = overrideRows[0] || null

    if (validOverride) {
      return { allowed: true, gate_type: DEMO_GATE }
    }

    return { allowed: false, reason: 'Invalid override', gate_type: DEMO_GATE }
  }

  return { allowed: false, reason: 'NDA not signed', gate_type: DEMO_GATE }
}

export async function canActivateTenant(
  organizationId: string,
  overrideId?: string,
): Promise<GateCheckResult> {
  const docResult = await sequelize.query(
    `SELECT id FROM legal_documents
     WHERE organization_id = :organizationId
       AND document_type = 'contract'
       AND platform_status = 'signed'
       AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    { replacements: { organizationId }, type: 'SELECT' },
  )

  const docRows = docResult as Array<{ id: string }>
  const signedDoc = docRows[0] || null

  if (signedDoc) {
    return { allowed: true, gate_type: ACTIVATION_GATE, document_id: signedDoc.id }
  }

  if (overrideId) {
    const overrideResult = await sequelize.query(
      `SELECT id FROM gate_overrides
       WHERE id = :overrideId
         AND gate_type = 'contract'
         AND (organization_id = :organizationId OR organization_id IS NULL AND lead_id IN (
           SELECT id FROM leads WHERE converted_organization_id = :organizationId AND deleted_at IS NULL
         ))
       LIMIT 1`,
      { replacements: { overrideId, organizationId }, type: 'SELECT' },
    )

    const overrideRows = overrideResult as Array<{ id: string }>
    const validOverride = overrideRows[0] || null

    if (validOverride) {
      return { allowed: true, gate_type: ACTIVATION_GATE }
    }

    return { allowed: false, reason: 'Invalid override', gate_type: ACTIVATION_GATE }
  }

  return { allowed: false, reason: 'Contract not signed', gate_type: ACTIVATION_GATE }
}
