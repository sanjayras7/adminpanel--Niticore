import { sequelize } from '@/lib/sequelize'

export interface GateResult {
  allowed: boolean
  reason?: string
}

export async function canActivateTenant(organizationId: string): Promise<GateResult> {
  try {
    const signedDoc = await sequelize.query(
      `SELECT id FROM legal_documents
       WHERE organization_id = :organizationId
         AND platform_status = 'signed'
         AND deleted_at IS NULL
       LIMIT 1`,
      {
        replacements: { organizationId },
        type: 'SELECT' as never,
      },
    )

    if (signedDoc && (signedDoc as Record<string, unknown>[]).length > 0) {
      return { allowed: true }
    }

    const override = await sequelize.query(
      `SELECT id FROM gate_overrides
       WHERE organization_id = :organizationId
         AND gate_type = 'contract'
       LIMIT 1`,
      {
        replacements: { organizationId },
        type: 'SELECT' as never,
      },
    )

    if (override && (override as Record<string, unknown>[]).length > 0) {
      return { allowed: true }
    }

    return {
      allowed: false,
      reason: 'Cannot transition to Active: no signed contract found and no override exists.',
    }
  } catch (err) {
    console.error('[GATES] canActivateTenant error:', err)
    return { allowed: false, reason: 'Activation gate check failed due to an internal error.' }
  }
}
