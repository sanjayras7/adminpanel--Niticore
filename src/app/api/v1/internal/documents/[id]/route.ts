import { NextRequest, NextResponse } from 'next/server'
import { LegalDocument } from '@/lib/models/LegalDocument'
import { requirePermission } from '@/lib/auth/requirePermission'
import { logAuditEvent } from '@/lib/audit'
import type { InternalSessionUser } from '@/lib/auth/session'

const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DOWNLOAD_ALLOWED_ROLES = ['Super Admin', 'Implementation Manager', 'Support', 'Read-only Auditor']

async function handler(
  request: NextRequest,
  { internalUser }: { internalUser: InternalSessionUser },
): Promise<NextResponse> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  const idIndex = pathParts.indexOf('documents') + 1
  const documentId = pathParts[idIndex]

  if (!documentId || !VALID_UUID.test(documentId)) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid document ID format.' },
      { status: 400 },
    )
  }

  let doc: LegalDocument | null
  try {
    doc = await LegalDocument.findByPk(documentId)
  } catch (err) {
    console.error('[DOCUMENTS] Database error during document lookup:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred.' },
      { status: 500 },
    )
  }

  if (!doc) {
    return NextResponse.json(
      { error: 'not_found', message: 'Document not found.' },
      { status: 404 },
    )
  }

  if (internalUser.roleName === 'Finance/Admin' && doc.document_type !== 'contract') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Insufficient permissions for this action' },
      { status: 403 },
    )
  }

  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = request.headers.get('user-agent') || null

  try {
    await logAuditEvent({
      actorInternalUserId: internalUser.id,
      actorRole: internalUser.roleName,
      action: 'document.view',
      targetType: 'legal_document',
      targetId: doc.id,
      organizationId: doc.organization_id,
      leadId: doc.lead_id,
      ipAddress,
      userAgent,
    })
  } catch (err) {
    console.error('[DOCUMENTS] Failed to write audit event:', err)
  }

  return NextResponse.json({
    id: doc.id,
    document_type: doc.document_type,
    file_name: doc.file_name,
    file_type: doc.file_type,
    file_size_bytes: doc.file_size_bytes,
    retention: doc.retention,
    signed_at: doc.signed_at,
    provider_name: doc.provider_name,
    platform_status: doc.platform_status,
    created_at: doc.created_at,
  })
}

export const GET = requirePermission('document-storage', 'read')(handler)
