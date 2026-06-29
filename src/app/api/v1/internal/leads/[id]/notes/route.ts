import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Lead, LeadNote } from '@/lib/models'
import { getInternalSession, isSessionError } from '@/lib/auth/session'
import { can } from '@/lib/authorization'
import { logAuditEvent } from '@/lib/audit'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await getInternalSession(request)
  if (isSessionError(session)) {
    return NextResponse.json(
      { error: session.error, message: session.message },
      { status: session.status },
    )
  }

  if (!can(session.roleName, 'leads', 'read')) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Insufficient permissions' },
      { status: 403 },
    )
  }

  try {
    const notes = await LeadNote.findAll({
      where: { lead_id: params.id, deleted_at: null },
      order: [['created_at', 'DESC']],
    })

    return NextResponse.json(notes)
  } catch (err) {
    console.error('[LEADS] Failed to fetch notes:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred' },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await getInternalSession(request)
  if (isSessionError(session)) {
    return NextResponse.json(
      { error: session.error, message: session.message },
      { status: session.status },
    )
  }

  if (!can(session.roleName, 'leads', 'create')) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Insufficient permissions' },
      { status: 403 },
    )
  }

  let body: { note_text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid request body' },
      { status: 400 },
    )
  }

  if (!body.note_text || typeof body.note_text !== 'string' || !body.note_text.trim()) {
    return NextResponse.json(
      { error: 'validation_error', field: 'note_text', message: 'Note text is required' },
      { status: 422 },
    )
  }

  try {
    const lead = await Lead.findByPk(params.id)
    if (!lead) {
      return NextResponse.json({ error: 'not_found', message: 'Lead not found' }, { status: 404 })
    }

    const note = await LeadNote.create({
      id: uuidv4(),
      lead_id: params.id,
      note_text: body.note_text.trim(),
      created_by: session.id,
      updated_by: null,
    } as LeadNote)

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const ua = request.headers.get('user-agent') || null

    await logAuditEvent({
      actorInternalUserId: session.id,
      actorRole: session.roleName,
      action: 'lead_note_created',
      targetType: 'lead_note',
      targetId: note.id,
      organizationId: null,
      leadId: params.id,
      beforeValues: null,
      afterValues: { note_text: body.note_text.trim() },
      reason: null,
      metadata: null,
      ipAddress: ip,
      userAgent: ua,
    })

    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    console.error('[LEADS] Failed to create note:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred' },
      { status: 500 },
    )
  }
}
