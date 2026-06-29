import { NextRequest, NextResponse } from 'next/server'
import { LegalDocument, isValidTransition } from '@/lib/models'
import { writeAuditEvent } from '@/lib/audit'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { createESignAdapter, ESignProviderError } from '@/lib/esign'

const ALLOWED_ROLES = ['Super Admin', 'Implementation Manager']

function hasContractPermission(roleName: string | null): boolean {
  return ALLOWED_ROLES.includes(roleName ?? '')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  let authUser
  try {
    authUser = await getAuthUser(request)
    requireMutationAuth(authUser)
  } catch (err: unknown) {
    const status = err instanceof Error && 'statusCode' in err ? (err as { statusCode: number }).statusCode : 403
    return NextResponse.json(
      { error: 'forbidden', message: err instanceof Error ? err.message : 'Forbidden' },
      { status },
    )
  }

  if (!hasContractPermission(authUser.roleName)) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only Implementation Manager and Super Admin may send contracts.' },
      { status: 403 },
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgentVal = request.headers.get('user-agent') || undefined

  try {
    const contract = await LegalDocument.findByPk(params.id)

    if (!contract) {
      return NextResponse.json(
        { error: 'not_found', message: 'Contract not found.' },
        { status: 404 },
      )
    }

    if (contract.document_type !== 'contract') {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Document is not a contract.' },
        { status: 400 },
      )
    }

    if (!isValidTransition(contract.platform_status as 'Draft', 'Sent')) {
      return NextResponse.json(
        { error: 'invalid_state', message: `Cannot send contract in status: ${contract.platform_status}.` },
        { status: 409 },
      )
    }

    if (!contract.provider_envelope_id) {
      return NextResponse.json(
        { error: 'invalid_state', message: 'Contract has no provider envelope ID.' },
        { status: 409 },
      )
    }

    const beforeStatus = contract.platform_status

    try {
      const adapter = createESignAdapter('dropbox_sign')

      const sendResult = await adapter.sendSigningRequest(contract.provider_envelope_id)

      if (sendResult.status === 'error') {
        return NextResponse.json(
          { error: 'provider_error', message: sendResult.errorMessage || 'E-Sign provider returned an error.' },
          { status: 502 },
        )
      }

      let signingUrl: string | null = null
      if (sendResult.status === 'sent') {
        signingUrl = `https://esign.example.com/envelopes/${contract.provider_envelope_id}/signing`
      }

      contract.platform_status = 'Sent'
      contract.sent_at = new Date()
      await contract.save()

      await writeAuditEvent({
        actor_internal_user_id: authUser.id,
        actor_role: authUser.roleName,
        action: 'contract.send',
        target_type: 'legal_document',
        target_id: contract.id,
        organization_id: contract.organization_id,
        before_values: { platform_status: beforeStatus },
        after_values: { platform_status: 'Sent', sent_at: contract.sent_at?.toISOString() },
        reason: 'Contract sent for signature',
        ip_address: ip,
        user_agent: userAgentVal,
      })

      return NextResponse.json({
        contract_id: contract.id,
        status: contract.platform_status,
        provider_envelope_id: contract.provider_envelope_id,
        signing_url: signingUrl,
      })
    } catch (adapterErr) {
      console.error('[CONTRACTS] Adapter send error:', adapterErr)
      return NextResponse.json(
        { error: 'provider_error', message: 'Failed to send contract via E-Sign provider.' },
        { status: 502 },
      )
    }
  } catch (err) {
    console.error('[CONTRACTS] Send error:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to send contract.' },
      { status: 500 },
    )
  }
}
