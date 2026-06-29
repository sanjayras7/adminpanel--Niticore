import { NextRequest, NextResponse } from 'next/server'
import { LegalDocument, isValidTransition } from '@/lib/models'
import { writeAuditEvent } from '@/lib/audit'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'

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

    if (!isValidTransition(contract.platform_status, 'Sent')) {
      return NextResponse.json(
        { error: 'invalid_state', message: `Cannot send contract in status: ${contract.platform_status}.` },
        { status: 409 },
      )
    }

    const beforeStatus = contract.platform_status

    const signingUrl = `https://esign.example.com/envelopes/${contract.provider_envelope_id}/signing`

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
  } catch (err) {
    console.error('[CONTRACTS] Send error:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to send contract.' },
      { status: 500 },
    )
  }
}
