'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'

interface Lead {
  id: string
  company_name: string
  contact_first_name: string
  contact_last_name: string
  work_email: string
  phone: string | null
  company_domain: string | null
  company_website: string | null
  country: string | null
  region: string | null
  company_size: string | null
  interested_modules_json: string[] | null
  interested_frameworks_json: string[] | null
  message: string | null
  source: string
  status: string
  assigned_owner_id: string | null
  nda_required: boolean
  demo_status: string | null
  contract_status: string | null
  created_at: string
}

interface LeadNote {
  id: string
  lead_id: string
  note_text: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

interface TimelineEvent {
  id: string
  actor: { id: string; role: string }
  action: string
  description: string
  target: { type: string; id: string }
  organizationId: string | null
  leadId: string | null
  createdAt: string
}

interface TimelineResponse {
  events: TimelineEvent[]
  nextCursor: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusBadgeStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
  }
  switch (status) {
    case 'New': return { ...base, background: '#E3F2FD', color: '#1565C0' }
    case 'Contacted': return { ...base, background: '#FFF8E1', color: '#F57F17' }
    case 'Qualified': return { ...base, background: '#E8F5E9', color: '#2E7D32' }
    case 'Lost': return { ...base, background: '#FFEBEE', color: '#C62828' }
    default: return { ...base, background: '#f0f0f0', color: '#555' }
  }
}

function demoStatusStyle(status: string | null): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
  }
  switch (status) {
    case 'Scheduled': return { ...base, background: '#E3F2FD', color: '#1565C0' }
    case 'Completed': return { ...base, background: '#E8F5E9', color: '#2E7D32' }
    case 'No Show': return { ...base, background: '#FFEBEE', color: '#C62828' }
    default: return { ...base, background: '#f0f0f0', color: '#555' }
  }
}

function contractStatusStyle(status: string | null): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
  }
  switch (status) {
    case 'Draft': return { ...base, background: '#FFF8E1', color: '#F57F17' }
    case 'Sent': return { ...base, background: '#E3F2FD', color: '#1565C0' }
    case 'Signed': return { ...base, background: '#E8F5E9', color: '#2E7D32' }
    case 'Declined': return { ...base, background: '#FFEBEE', color: '#C62828' }
    default: return { ...base, background: '#f0f0f0', color: '#555' }
  }
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value || '—'}</span>
    </div>
  )
}

function TagList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return <span style={{ color: '#999', fontSize: 13 }}>None</span>
  }
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {items.map((item) => (
        <span key={item} style={styles.tag}>{item}</span>
      ))}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {children}
    </div>
  )
}

export default function LeadDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const leadId = params.id as string

  const [lead, setLead] = useState<Lead | null>(null)
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timelineError, setTimelineError] = useState(false)

  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [leadRes, notesRes] = await Promise.all([
        fetch(`/api/v1/internal/leads/${leadId}`, { credentials: 'include' }),
        fetch(`/api/v1/internal/leads/${leadId}/notes`, { credentials: 'include' }),
      ])

      if (!leadRes.ok) {
        if (leadRes.status === 401 || leadRes.status === 403) {
          setError('You do not have permission to view this lead.')
        } else if (leadRes.status === 404) {
          setError('Lead not found.')
        } else {
          setError('Failed to load lead details. Please try again.')
        }
        return
      }

      const leadData: Lead = await leadRes.json()
      setLead(leadData)

      if (notesRes.ok) {
        const notesData: LeadNote[] = await notesRes.json()
        setNotes(notesData)
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/audit/timeline?lead_id=${leadId}&limit=50`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data: TimelineResponse = await res.json()
        setTimeline(data.events)
      } else {
        setTimelineError(true)
      }
    } catch {
      setTimelineError(true)
    }
  }, [leadId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!loading && lead) {
      fetchTimeline()
    }
  }, [loading, lead, fetchTimeline])

  async function handleCreateNote() {
    if (!noteText.trim()) return
    setSubmitting(true)
    setNoteError(null)

    try {
      const res = await fetch(`/api/v1/internal/leads/${leadId}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: noteText.trim() }),
      })

      if (!res.ok) {
        if (res.status === 422) {
          setNoteError('Note text is required.')
        } else if (res.status === 403) {
          setNoteError('You do not have permission to create notes.')
        } else {
          setNoteError('Failed to create note. Please try again.')
        }
        return
      }

      const created: LeadNote = await res.json()
      setNotes((prev) => [created, ...prev])
      setNoteText('')
    } catch {
      setNoteError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateNote(noteId: string) {
    if (!editText.trim()) return
    setSubmitting(true)
    setNoteError(null)

    try {
      const res = await fetch(`/api/v1/internal/leads/${leadId}/notes/${noteId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: editText.trim() }),
      })

      if (!res.ok) {
        if (res.status === 422) {
          setNoteError('Note text is required.')
        } else if (res.status === 403) {
          setNoteError('You do not have permission to edit notes.')
        } else if (res.status === 404) {
          setNoteError('Note not found.')
        } else {
          setNoteError('Failed to update note. Please try again.')
        }
        return
      }

      const updated: LeadNote = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      setEditingNoteId(null)
      setEditText('')
    } catch {
      setNoteError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteNote(noteId: string) {
    setNoteError(null)

    try {
      const res = await fetch(`/api/v1/internal/leads/${leadId}/notes/${noteId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        if (res.status === 403) {
          setNoteError('You do not have permission to delete notes.')
        } else if (res.status === 404) {
          setNoteError('Note not found.')
        } else {
          setNoteError('Failed to delete note. Please try again.')
        }
        return
      }

      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      if (editingNoteId === noteId) {
        setEditingNoteId(null)
        setEditText('')
      }
    } catch {
      setNoteError('Network error. Please try again.')
    }
  }

  function startEdit(note: LeadNote) {
    setEditingNoteId(note.id)
    setEditText(note.note_text)
    setNoteError(null)
  }

  function cancelEdit() {
    setEditingNoteId(null)
    setEditText('')
    setNoteError(null)
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div style={styles.errorBanner}>{error}</div>
        <button onClick={fetchAll} style={styles.retryButton}>Retry</button>
        <a href="/internal/leads" style={styles.backLink}>Back to leads</a>
      </div>
    )
  }

  if (!lead) return null

  return (
    <div>
      <div style={styles.header}>
        <a href="/internal/leads" style={styles.backLink}>&larr; Back to leads</a>
        <h1 style={styles.title}>{lead.company_name}</h1>
        <span style={statusBadgeStyle(lead.status)}>{lead.status}</span>
      </div>

      <div style={styles.grid}>
        <SectionCard title="Company Profile">
          <InfoRow label="Company Name" value={lead.company_name} />
          <InfoRow label="Domain" value={lead.company_domain} />
          <InfoRow label="Website" value={lead.company_website} />
          <InfoRow label="Company Size" value={lead.company_size} />
          <InfoRow label="Country" value={lead.country} />
          <InfoRow label="Region" value={lead.region} />
        </SectionCard>

        <SectionCard title="Contact Info">
          <InfoRow label="First Name" value={lead.contact_first_name} />
          <InfoRow label="Last Name" value={lead.contact_last_name} />
          <InfoRow label="Email" value={lead.work_email} />
          <InfoRow label="Phone" value={lead.phone} />
          <InfoRow label="Message" value={lead.message} />
        </SectionCard>

        <SectionCard title="Interests">
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Modules</span>
            <TagList items={lead.interested_modules_json} />
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Frameworks</span>
            <TagList items={lead.interested_frameworks_json} />
          </div>
        </SectionCard>

        <SectionCard title="Assignment & Status">
          <InfoRow label="Source" value={lead.source} />
          <InfoRow label="Owner ID" value={lead.assigned_owner_id} />
          <InfoRow label="Created" value={formatDate(lead.created_at)} />
        </SectionCard>

        <SectionCard title="NDA / Demo / Contract">
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>NDA Required</span>
            <span style={{
              ...styles.badge,
              ...(lead.nda_required ? styles.badgeYes : styles.badgeNo),
            }}>
              {lead.nda_required ? 'Yes' : 'No'}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Demo Status</span>
            <span style={demoStatusStyle(lead.demo_status)}>
              {lead.demo_status || '—'}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Contract Status</span>
            <span style={contractStatusStyle(lead.contract_status)}>
              {lead.contract_status || '—'}
            </span>
          </div>
        </SectionCard>
      </div>

      <div style={styles.section}>
        <SectionCard title="Notes">
          {noteError && (
            <div style={styles.noteError}>{noteError}</div>
          )}

          <div style={styles.noteInputRow}>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              style={styles.noteInput}
            />
            <button
              onClick={handleCreateNote}
              disabled={submitting || !noteText.trim()}
              style={{
                ...styles.primaryButton,
                opacity: submitting || !noteText.trim() ? 0.6 : 1,
              }}
            >
              {submitting ? 'Saving...' : 'Add Note'}
            </button>
          </div>

          {notes.length === 0 ? (
            <p style={styles.emptyText}>No notes yet.</p>
          ) : (
            <div style={styles.noteList}>
              {notes.map((note) => (
                <div key={note.id} style={styles.noteItem}>
                  {editingNoteId === note.id ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        style={styles.noteInput}
                      />
                      <div style={styles.noteActions}>
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          disabled={submitting || !editText.trim()}
                          style={styles.primaryButton}
                        >
                          {submitting ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={cancelEdit} style={styles.secondaryButton}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={styles.noteText}>{note.note_text}</div>
                      <div style={styles.noteMeta}>
                        <span>{formatDateTime(note.created_at)}</span>
                        {note.updated_by && note.updated_at !== note.created_at && (
                          <span> &middot; Edited {formatDateTime(note.updated_at)}</span>
                        )}
                      </div>
                      <div style={styles.noteActions}>
                        <button onClick={() => startEdit(note)} style={styles.smallButton}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteNote(note.id)} style={styles.smallButtonDanger}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div style={styles.section}>
        <SectionCard title="Activity Timeline">
          {timelineError ? (
            <p style={styles.emptyText}>Could not load activity timeline.</p>
          ) : timeline.length === 0 ? (
            <p style={styles.emptyText}>No activity yet.</p>
          ) : (
            <div style={styles.timeline}>
              {timeline.map((event) => (
                <div key={event.id} style={styles.timelineItem}>
                  <div style={styles.timelineDot} />
                  <div>
                    <div style={styles.timelineDesc}>{event.description}</div>
                    <div style={styles.timelineTime}>{formatDateTime(event.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    margin: 0,
    color: '#1a1a1a',
  },
  backLink: {
    fontSize: 14,
    color: '#0052CC',
    textDecoration: 'none',
    marginRight: 8,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: '0 0 16px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '6px 0',
    borderBottom: '1px solid #f5f5f5',
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: 500,
    minWidth: 100,
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    textAlign: 'right' as const,
    wordBreak: 'break-all',
  },
  tag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    background: '#E8F0FE',
    color: '#1565C0',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
  },
  badgeYes: {
    background: '#E8F5E9',
    color: '#2E7D32',
  },
  badgeNo: {
    background: '#f0f0f0',
    color: '#555',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: 48,
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid #e0e0e0',
    borderTop: '3px solid #0052CC',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBanner: {
    padding: '12px 16px',
    background: '#FFF0F0',
    border: '1px solid #FFCDD2',
    borderRadius: 6,
    color: '#D32F2F',
    fontSize: 14,
    marginBottom: 16,
  },
  retryButton: {
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 500,
    border: 'none',
    borderRadius: 6,
    background: '#0052CC',
    color: '#fff',
    cursor: 'pointer',
    marginRight: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center' as const,
    padding: 16,
  },
  noteError: {
    padding: '8px 12px',
    background: '#FFF0F0',
    border: '1px solid #FFCDD2',
    borderRadius: 6,
    color: '#D32F2F',
    fontSize: 13,
    marginBottom: 12,
  },
  noteInputRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  noteInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 6,
    background: '#fff',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  primaryButton: {
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 500,
    border: 'none',
    borderRadius: 6,
    background: '#0052CC',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  secondaryButton: {
    padding: '6px 12px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    color: '#555',
  },
  smallButton: {
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid #ccc',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    color: '#555',
  },
  smallButtonDanger: {
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid #FFCDD2',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
    color: '#D32F2F',
  },
  noteList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  noteItem: {
    padding: 12,
    background: '#fafafa',
    borderRadius: 6,
    border: '1px solid #f0f0f0',
  },
  noteText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  noteMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  noteActions: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
  },
  timeline: {
    position: 'relative' as const,
    paddingLeft: 20,
  },
  timelineItem: {
    display: 'flex',
    gap: 12,
    paddingBottom: 16,
    position: 'relative' as const,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#0052CC',
    flexShrink: 0,
    marginTop: 4,
  },
  timelineDesc: {
    fontSize: 14,
    color: '#333',
  },
  timelineTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
}
