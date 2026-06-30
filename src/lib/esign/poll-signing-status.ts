import { LegalDocument } from '@/lib/models/LegalDocument'
import { logAuditEvent } from '@/lib/audit'
import { ESignAdapter } from './ESignAdapter'
import { createESignAdapter } from './index'

const TERMINAL_STATUSES = new Set(['signed', 'declined', 'expired', 'voided'])

export interface PollSigningStatusResult {
  envelopeId: string
  previousPlatformStatus: string | null
  newPlatformStatus: string
  updated: boolean
}

export async function pollSigningStatus(envelopeId: string): Promise<PollSigningStatusResult> {
  const doc = await LegalDocument.findOne({
    where: { provider_envelope_id: envelopeId },
  })

  if (!doc) {
    return {
      envelopeId,
      previousPlatformStatus: null,
      newPlatformStatus: 'unknown',
      updated: false,
    }
  }

  if (doc.platform_status && TERMINAL_STATUSES.has(doc.platform_status)) {
    return {
      envelopeId,
      previousPlatformStatus: doc.platform_status,
      newPlatformStatus: doc.platform_status,
      updated: false,
    }
  }

  const adapter: ESignAdapter = createESignAdapter(
    (doc.provider_name || 'dropbox_sign') as 'dropbox_sign' | 'mock',
  )

  const statusResult = await adapter.getSigningRequestStatus(envelopeId)
  const update = adapter.buildLegalDocumentUpdate(statusResult)

  if (update.platform_status === doc.platform_status) {
    return {
      envelopeId,
      previousPlatformStatus: doc.platform_status,
      newPlatformStatus: doc.platform_status,
      updated: false,
    }
  }

  await LegalDocument.update(
    {
      provider_status: update.provider_status,
      platform_status: update.platform_status,
      sent_at: update.sent_at ?? undefined,
      viewed_at: update.viewed_at ?? undefined,
      signed_at: update.signed_at ?? undefined,
      declined_at: update.declined_at ?? undefined,
      expired_at: update.expired_at ?? undefined,
      voided_at: update.voided_at ?? undefined,
    },
    { where: { id: doc.id } },
  )

  await logAuditEvent({
    actorInternalUserId: '00000000-0000-0000-0000-000000000000',
    actorRole: 'system',
    action: 'esign.status_polled',
    targetType: 'legal_document',
    targetId: doc.id,
    leadId: doc.lead_id,
    organizationId: doc.organization_id,
    beforeValues: { platform_status: doc.platform_status },
    afterValues: { platform_status: update.platform_status },
    reason: null,
    metadata: { envelopeId, provider: doc.provider_name },
    ipAddress: null,
    userAgent: null,
  })

  return {
    envelopeId,
    previousPlatformStatus: doc.platform_status,
    newPlatformStatus: update.platform_status,
    updated: true,
  }
}
