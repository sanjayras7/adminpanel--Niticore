import { NextRequest, NextResponse } from 'next/server'
import { LegalDocument } from '@/lib/models/LegalDocument'
import { DropboxSignAdapter } from '@/lib/esign/DropboxSignAdapter'
import { logAuditEvent } from '@/lib/audit'
import type { WebhookEvent } from '@/lib/esign/types'

const WEBHOOK_PROVIDERS: Array<{
  signatureHeader: string
  createAdapter: () => DropboxSignAdapter
}> = [
  {
    signatureHeader: 'dropbox-signature',
    createAdapter: () => new DropboxSignAdapter(),
  },
]

function detectProvider(headers: Headers): { adapter: DropboxSignAdapter; signatureHeader: string } | null {
  for (const provider of WEBHOOK_PROVIDERS) {
    const value = headers.get(provider.signatureHeader)
    if (value) {
      return { adapter: provider.createAdapter(), signatureHeader: value }
    }
  }
  return null
}

interface WebhookUpdateFields {
  provider_status: string
  platform_status: string
  sent_at?: Date
  viewed_at?: Date
  signed_at?: Date
  declined_at?: Date
  expired_at?: Date
  voided_at?: Date
}

function buildWebhookUpdate(event: WebhookEvent): WebhookUpdateFields {
  const at = new Date(event.occurredAt)
  const base: WebhookUpdateFields = {
    provider_status: event.providerRawEvent,
    platform_status: event.eventType,
  }

  switch (event.eventType) {
    case 'sent': return { ...base, sent_at: at }
    case 'viewed': return { ...base, viewed_at: at }
    case 'signed': return { ...base, signed_at: at }
    case 'declined': return { ...base, declined_at: at }
    case 'expired': return { ...base, expired_at: at }
    case 'voided': return { ...base, voided_at: at }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const detected = detectProvider(req.headers)
  if (!detected) {
    return NextResponse.json(
      { error: 'No recognized webhook provider' },
      { status: 401 },
    )
  }

  const { adapter, signatureHeader } = detected

  let rawText: string
  try {
    rawText = await req.text()
  } catch {
    return NextResponse.json(
      { error: 'Could not read request body' },
      { status: 400 },
    )
  }

  const rawBody = Buffer.from(rawText, 'utf-8')

  if (!adapter.verifyWebhookSignature(rawBody, signatureHeader)) {
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 401 },
    )
  }

  let event: WebhookEvent
  try {
    event = adapter.parseWebhookEvent(rawBody)
  } catch {
    return NextResponse.json(
      { error: 'Could not parse webhook event' },
      { status: 400 },
    )
  }

  const doc = await LegalDocument.findOne({
    where: { provider_envelope_id: event.envelopeId },
  })

  if (!doc) {
    return NextResponse.json(
      { error: 'Envelope not found', envelopeId: event.envelopeId },
      { status: 404 },
    )
  }

  const update = buildWebhookUpdate(event)

  const terminalPlatformStatuses = ['signed', 'declined', 'expired', 'voided']
  if (doc.platform_status && terminalPlatformStatuses.includes(doc.platform_status)) {
    return NextResponse.json({ received: true, ignored: true, reason: 'already_terminal' })
  }

  await LegalDocument.update(update, { where: { id: doc.id } })

  await logAuditEvent({
    actorInternalUserId: '00000000-0000-0000-0000-000000000000',
    actorRole: 'system',
    action: 'esign.webhook_received',
    targetType: 'legal_document',
    targetId: doc.id,
    leadId: doc.lead_id,
    organizationId: doc.organization_id,
    beforeValues: { platform_status: doc.platform_status },
    afterValues: { platform_status: event.eventType },
    reason: null,
    metadata: { envelopeId: event.envelopeId, providerRawEvent: event.providerRawEvent },
    ipAddress: null,
    userAgent: null,
  })

  return NextResponse.json({ received: true, envelopeId: event.envelopeId, eventType: event.eventType })
}
