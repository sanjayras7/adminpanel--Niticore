import { NextRequest, NextResponse } from 'next/server'
import { sequelize } from '@/lib/sequelize'
import { LegalDocument, isValidStatus, isValidTransition, type PlatformStatus } from '@/lib/models'
import { writeAuditEvent } from '@/lib/audit'

interface WebhookEvent {
  event_type: string
  provider_envelope_id: string
  occurred_at: string
  provider_raw_status?: string
}

const EVENT_TO_STATUS: Record<string, PlatformStatus> = {
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Signed',
  declined: 'Declined',
  expired: 'Expired',
  voided: 'Voided',
}

const EVENT_TO_TIMESTAMP_FIELD: Record<string, keyof LegalDocument> = {
  sent: 'sent_at',
  viewed: 'viewed_at',
  signed: 'signed_at',
  declined: 'declined_at',
  expired: 'expired_at',
  voided: 'voided_at',
}

async function logDeadLetter(
  envelopeId: string,
  eventType: string,
  reason: string,
  rawPayload: unknown,
): Promise<void> {
  console.warn('[WEBHOOK] Dead-letter event:', {
    provider_envelope_id: envelopeId,
    event_type: eventType,
    reason,
    raw_payload: JSON.stringify(rawPayload).slice(0, 2000),
    occurred_at: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: WebhookEvent
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid webhook payload.' },
      { status: 400 },
    )
  }

  if (!body.event_type || !body.provider_envelope_id) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'event_type and provider_envelope_id are required.' },
      { status: 400 },
    )
  }

  const targetStatus = EVENT_TO_STATUS[body.event_type]
  if (!targetStatus) {
    return NextResponse.json(
      { error: 'invalid_request', message: `Unknown event_type: ${body.event_type}` },
      { status: 400 },
    )
  }

  const timestampField = EVENT_TO_TIMESTAMP_FIELD[body.event_type]

  try {
    const contract = await LegalDocument.findOne({
      where: {
        provider_envelope_id: body.provider_envelope_id,
        document_type: 'contract',
        deleted_at: null,
      },
    })

    if (!contract) {
      await logDeadLetter(body.provider_envelope_id, body.event_type, 'unknown_envelope', body)
      return NextResponse.json(
        { error: 'not_found', message: 'No contract found for this envelope.' },
        { status: 404 },
      )
    }

    if (!isValidStatus(contract.platform_status)) {
      console.warn('[WEBHOOK] Invalid current status on contract:', {
        id: contract.id,
        current_status: contract.platform_status,
      })
      return NextResponse.json(
        { error: 'invalid_state', message: 'Contract has an invalid status.' },
        { status: 409 },
      )
    }

    if (contract.platform_status === targetStatus) {
      return NextResponse.json({ status: 'ignored_duplicate' })
    }

    if (!isValidTransition(contract.platform_status, targetStatus)) {
      console.warn('[WEBHOOK] Invalid status transition:', {
        id: contract.id,
        from: contract.platform_status,
        to: targetStatus,
      })
      return NextResponse.json(
        {
          error: 'invalid_transition',
          message: `Cannot transition from ${contract.platform_status} to ${targetStatus}.`,
        },
        { status: 409 },
      )
    }

    const beforeStatus = contract.platform_status

    await sequelize.transaction(async (t) => {
      contract.platform_status = targetStatus

      if (timestampField && typeof contract[timestampField] === 'undefined') {
        ;(contract as Record<string, unknown>)[timestampField as string] = body.occurred_at
          ? new Date(body.occurred_at)
          : new Date()
      }

      if (body.provider_raw_status) {
        contract.provider_status = body.provider_raw_status
      }

      await contract.save({ transaction: t })

      await writeAuditEvent({
        actor_internal_user_id: '00000000-0000-0000-0000-000000000000',
        actor_role: 'system',
        action: 'contract.status_update',
        target_type: 'legal_document',
        target_id: contract.id,
        organization_id: contract.organization_id,
        before_values: { platform_status: beforeStatus },
        after_values: {
          platform_status: targetStatus,
          provider_status: body.provider_raw_status ?? null,
        },
        reason: `Webhook: ${body.event_type}`,
        ip_address: undefined,
        user_agent: undefined,
      })
    })

    return NextResponse.json({ status: 'updated', platform_status: targetStatus })
  } catch (err) {
    console.error('[WEBHOOK] Processing error:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to process webhook.' },
      { status: 500 },
    )
  }
}
