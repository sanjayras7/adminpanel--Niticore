import { NextRequest, NextResponse } from 'next/server'
import { Lead, LeadNote } from '@/lib/models'
import { getInternalSession, isSessionError } from '@/lib/auth/session'
import { can } from '@/lib/authorization'
import { logAuditEvent } from '@/lib/audit'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } },
): Promise<NextResponse> {
  const session = await getInternalSession(request)
  if (isSessionError(session)) {
    return NextResponse.json(
      { error: session.error, message: session.message },
      { status: session.status },
    )
  }

  if (!can(session.roleName, 'leads', 'update')) {
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

    const note = await LeadNote.findOne({
      where: { id: params.noteId, lead_id: params.id, deleted_at: null },
    })

    if (!note) {
      return NextResponse.json({ error: 'not_found', message: 'Note not found' }, { status: 404 })
    }

    const beforeText = note.note_text
    note.note_text = body.note_text.trim()
    note.updated_by = session.id
    await note.save()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const ua = request.headers.get('user-agent') || null

    await logAuditEvent({
      actorInternalUserId: session.id,
      actorRole: session.roleName,
      action: 'lead_note_updated',
      targetType: 'lead_note',
      targetId: note.id,
      organizationId: null,
      leadId: params.id,
      beforeValues: { note_text: beforeText },
      afterValues: { note_text: note.note_text },
      reason: null,
      metadata: null,
      ipAddress: ip,
      userAgent: ua,
    })

    return NextResponse.json(note)
  } catch (err) {
    console.error('[LEADS] Failed to update note:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } },
): Promise<NextResponse> {
  const session = await getInternalSession(request)
  if (isSessionError(session)) {
    return NextResponse.json(
      { error: session.error, message: session.message },
      { status: session.status },
    )
  }

  if (!can(session.roleName, 'leads', 'delete')) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Insufficient permissions' },
      { status: 403 },
    )
  }

  try {
    const note = await LeadNote.findOne({
      where: { id: params.noteId, lead_id: params.id, deleted_at: null },
    })

    if (!note) {
      return NextResponse.json({ error: 'not_found', message: 'Note not found' }, { status: 404 })
    }

    note.updated_by = session.id
    await note.destroy()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const ua = request.headers.get('user-agent') || null

    await logAuditEvent({
      actorInternalUserId: session.id,
      actorRole: session.roleName,
      action: 'lead_note_deleted',
      targetType: 'lead_note',
      targetId: params.noteId,
      organizationId: null,
      leadId: params.id,
      beforeValues: null,
      afterValues: null,
      reason: null,
      metadata: null,
      ipAddress: ip,
      userAgent: ua,
    })

    return NextResponse.json({ message: 'Note deleted' })
  } catch (err) {
    console.error('[LEADS] Failed to delete note:', err)
    return NextResponse.json(
      { error: 'server_error', message: 'An internal error occurred' },
      { status: 500 },
    )
  }
}
