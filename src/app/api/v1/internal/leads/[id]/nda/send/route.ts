import { NextRequest, NextResponse } from 'next/server'
import { Lead } from '@/lib/models/Lead'
import { LegalDocument } from '@/lib/models/LegalDocument'
import { requirePermission } from '@/lib/auth/requirePermission'
import { logAuditEvent } from '@/lib/audit'
import { createESignAdapter } from '@/lib/esign'
import type { InternalSessionUser } from '@/lib/auth/session'

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TERMINAL_STATUSES = ['signed', 'declined', 'expired', 'voided']

async function handler(
  request: NextRequest,
  { internalUser }: { internalUser: InternalSessionUser },
): Promise<NextResponse> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  const idIndex = pathParts.indexOf('leads') + 1
  const leadId = pathParts[idIndex]

  if (!leadId || !VALID_UUID.test(leadId)) {
    return NextResponse.json(
      { error: 'invalid_lead_id', message: 'Invalid lead ID format.' },
      { status: 400 },
    )
  }

  let body: { signer_name?: string; signer_email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body.' },
      { status: 400 },
    )
  }

  if (typeof body.signer_name !== 'string' || body.signer_name.trim() === '') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'signer_name is required.' },
      { status: 400 },
    )
  }

  if (typeof body.signer_email !== 'string' || body.signer_email.trim() === '') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'signer_email is required.' },
      { status: 400 },
    )
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(body.signer_email.trim())) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid signer email format.' },
      { status: 400 },
    )
  }

  let lead: Lead | null
  try {
    lead = await Lead.findByPk(leadId)
  } catch (err) {
    console.error('[NDA_SEND] Database error during lead lookup:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (!lead || lead.deleted_at !== null) {
    return NextResponse.json(
      { error: 'not_found', message: 'Lead not found.' },
      { status: 404 },
    )
  }

  let existingDoc: LegalDocument | null
  try {
    existingDoc = await LegalDocument.findOne({
      where: {
        lead_id: leadId,
        document_type: 'nda',
      },
      order: [['created_at', 'DESC']],
    })
  } catch (err) {
    console.error('[NDA_SEND] Database error during document lookup:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (existingDoc && existingDoc.platform_status && !TERMINAL_STATUSES.includes(existingDoc.platform_status)) {
    return NextResponse.json(
      {
        error: 'conflict',
        message: 'An NDA for this lead is already in progress. Void the existing document before sending a new one.',
        existing_document_id: existingDoc.id,
        existing_status: existingDoc.platform_status,
      },
      { status: 409 },
    )
  }

  const signerName = body.signer_name.trim()
  const signerEmail = body.signer_email.trim()

  let doc: LegalDocument
  try {
    doc = await LegalDocument.create({
      document_type: 'nda',
      lead_id: leadId,
      organization_id: null,
      platform_status: 'draft',
      signer_names_json: JSON.stringify([signerName]),
      signer_emails_json: JSON.stringify([signerEmail]),
      created_by: internalUser.id,
      created_at: new Date(),
      updated_at: new Date(),
    })
  } catch (err) {
    console.error('[NDA_SEND] Database error creating document:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to create NDA document.' },
      { status: 500 },
    )
  }

  const providerName = (process.env.ESIGN_PROVIDER || 'mock') as 'dropbox_sign' | 'mock'
  const apiKey = process.env.HELLOSIGN_API_KEY

  let adapter
  try {
    adapter = createESignAdapter(providerName, apiKey)
  } catch (err) {
    console.error('[NDA_SEND] Failed to create esign adapter:', err)
    await doc.destroy()
    return NextResponse.json(
      { error: 'adapter_error', message: 'E-sign provider is not configured.' },
      { status: 502 },
    )
  }

  let createResult
  try {
    createResult = await adapter.createSigningRequest({
      title: `NDA - ${lead.company_name}`,
      signers: [{ name: signerName, email: signerEmail }],
      fileBytes: [{ filename: 'nda.pdf', content: Buffer.from('NDA document content for ' + lead.company_name) }],
    })
  } catch (err) {
    console.error('[NDA_SEND] Adapter createSigningRequest failed:', err)
    try {
      doc.platform_status = 'draft'
      await doc.save()
    } catch {
    }
    return NextResponse.json(
      { error: 'adapter_error', message: 'Failed to create signing request with the e-sign provider.' },
      { status: 502 },
    )
  }

  if (createResult.status === 'error') {
    try {
      doc.platform_status = 'draft'
      await doc.save()
    } catch {
    }
    return NextResponse.json(
      { error: 'adapter_error', message: createResult.errorMessage || 'E-sign provider returned an error.' },
      { status: 502 },
    )
  }

  let sendResult
  try {
    sendResult = await adapter.sendSigningRequest(createResult.envelopeId)
  } catch (err) {
    console.error('[NDA_SEND] Adapter sendSigningRequest failed:', err)
    try {
      doc.platform_status = 'draft'
      doc.provider_envelope_id = createResult.envelopeId
      doc.provider_name = providerName
      await doc.save()
    } catch {
    }
    return NextResponse.json(
      { error: 'adapter_error', message: 'Failed to send signing request via the e-sign provider.' },
      { status: 502 },
    )
  }

  if (sendResult.status === 'error') {
    try {
      doc.platform_status = 'draft'
      doc.provider_envelope_id = createResult.envelopeId
      doc.provider_name = providerName
      await doc.save()
    } catch {
    }
    return NextResponse.json(
      { error: 'adapter_error', message: sendResult.errorMessage || 'E-sign provider returned an error on send.' },
      { status: 502 },
    )
  }

  try {
    doc.provider_name = providerName
    doc.provider_envelope_id = createResult.envelopeId
    doc.platform_status = 'sent'
    doc.sent_at = new Date()
    doc.updated_at = new Date()
    await doc.save()
  } catch (err) {
    console.error('[NDA_SEND] Database error updating document after send:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'NDA was sent but failed to update status.' },
      { status: 500 },
    )
  }

  try {
    await logAuditEvent({
      actorInternalUserId: internalUser.id,
      actorRole: internalUser.roleName,
      action: 'legal_document.sent',
      targetType: 'legal_document',
      targetId: doc.id,
      leadId: leadId,
      afterValues: {
        document_type: 'nda',
        provider_name: providerName,
        provider_envelope_id: createResult.envelopeId,
        platform_status: 'sent',
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent') || null,
    })
  } catch (err) {
    console.error('[NDA_SEND] Failed to write audit event:', err)
  }

  return NextResponse.json(
    {
      id: doc.id,
      document_type: doc.document_type,
      lead_id: doc.lead_id,
      platform_status: doc.platform_status,
      provider_name: doc.provider_name,
      provider_envelope_id: doc.provider_envelope_id,
      sent_at: doc.sent_at,
      signer_names_json: doc.signer_names_json,
      signer_emails_json: doc.signer_emails_json,
      created_at: doc.created_at,
    },
    { status: 201 },
  )
}

export const POST = requirePermission('nda-contracts', 'create')(handler)
