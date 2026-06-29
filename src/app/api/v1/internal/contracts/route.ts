import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { sequelize } from '@/lib/sequelize'
import { LegalDocument } from '@/lib/models'
import { writeAuditEvent } from '@/lib/audit'
import { getAuthUser, requireMutationAuth } from '@/lib/auth'
import { createESignAdapter, ESignProviderError, type CreateSigningRequestParams } from '@/lib/esign'

interface CreateContractInput {
  organization_id: string
  contract_type?: string
  template_id?: string
  signers: { name: string; email: string }[]
  metadata?: Record<string, string>
}

const ALLOWED_ROLES = ['Super Admin', 'Implementation Manager']

function hasContractPermission(roleName: string | null): boolean {
  return ALLOWED_ROLES.includes(roleName ?? '')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  let body: CreateContractInput
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (!body.organization_id) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'organization_id is required.' },
      { status: 400 },
    )
  }

  if (!Array.isArray(body.signers) || body.signers.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'At least one signer is required.' },
      { status: 400 },
    )
  }

  for (const s of body.signers) {
    if (!s.name?.trim() || !s.email?.trim()) {
      return NextResponse.json(
        { error: 'invalid_request', message: 'Each signer must have a name and email.' },
        { status: 400 },
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) {
      return NextResponse.json(
        { error: 'invalid_request', message: `Invalid email: ${s.email}` },
        { status: 400 },
      )
    }
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgentVal = request.headers.get('user-agent') || undefined

  try {
    const result = await sequelize.transaction(async (t) => {
      const existingActive = await LegalDocument.findOne({
        where: {
          organization_id: body.organization_id,
          document_type: 'contract',
          platform_status: ['Draft', 'Sent', 'Viewed'],
          deleted_at: null,
        },
        transaction: t,
      })

      if (existingActive) {
        const err = new Error('Organization already has an active contract.')
        ;(err as { statusCode: number }).statusCode = 409
        throw err
      }

      const adapter = createESignAdapter('dropbox_sign')

      const signerParams: CreateSigningRequestParams = {
        title: 'Contract',
        message: 'Please review and sign this contract.',
        signers: body.signers.map((s) => ({ name: s.name.trim(), email: s.email.trim() })),
        ccEmailAddresses: [],
      }

      let providerResult
      try {
        providerResult = await adapter.createSigningRequest(signerParams)
      } catch (adapterErr) {
        const err = new Error('E-Sign provider create failed.')
        ;(err as { statusCode: number }).statusCode = 502
        ;(err as { cause: unknown }).cause = adapterErr
        throw err
      }

      if (providerResult.status === 'error') {
        const err = new Error(providerResult.errorMessage || 'E-Sign provider returned an error.')
        ;(err as { statusCode: number }).statusCode = 502
        throw err
      }

      const record = await LegalDocument.create(
        {
          document_type: 'contract',
          organization_id: body.organization_id,
          provider_name: providerResult.providerName,
          provider_envelope_id: providerResult.envelopeId,
          platform_status: 'Draft',
          signer_names_json: JSON.stringify(body.signers.map((s) => s.name.trim())),
          signer_emails_json: JSON.stringify(body.signers.map((s) => s.email.trim())),
          created_by: authUser.id,
          provider_status: null,
          sent_at: null,
          viewed_at: null,
          signed_at: null,
          declined_at: null,
          expired_at: null,
          voided_at: null,
        },
        { transaction: t },
      )

      await writeAuditEvent({
        actor_internal_user_id: authUser.id,
        actor_role: authUser.roleName,
        action: 'contract.create',
        target_type: 'legal_document',
        target_id: record.id,
        organization_id: body.organization_id,
        before_values: null,
        after_values: {
          platform_status: record.platform_status,
          document_type: record.document_type,
        },
        reason: 'Contract created',
        ip_address: ip,
        user_agent: userAgentVal,
      })

      return record
    })

    return NextResponse.json(
      {
        contract_id: result.id,
        status: result.platform_status,
        document_type: result.document_type,
        organization_id: result.organization_id,
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    if (err instanceof Error && 'statusCode' in err) {
      const statusCode = (err as { statusCode: number }).statusCode
      if (statusCode === 409) {
        return NextResponse.json(
          { error: 'conflict', message: 'Organization already has an active contract.' },
          { status: 409 },
        )
      }
      if (statusCode === 502) {
        return NextResponse.json(
          { error: 'provider_error', message: err.message },
          { status: 502 },
        )
      }
    }
    console.error('[CONTRACTS] Create error:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to create contract.' },
      { status: 500 },
    )
  }
}
