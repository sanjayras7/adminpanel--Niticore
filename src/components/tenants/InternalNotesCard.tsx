'use client'

import type { InternalNote } from '@/lib/queries/tenant'
import { useState } from 'react'

interface Props {
  notes: InternalNote[]
  error?: string
  onAddNote?: (text: string) => Promise<void>
}

export default function InternalNotesCard({ notes, error, onAddNote }: Props) {
  const [newNote, setNewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim() || !onAddNote) return
    setSubmitting(true)
    try {
      await onAddNote(newNote.trim())
      setNewNote('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Internal Notes</h2>
      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : (
        <>
          {notes.length === 0 ? (
            <p className="mb-4 text-sm text-gray-500">No internal notes</p>
          ) : (
            <div className="mb-4 max-h-80 space-y-3 overflow-y-auto">
              {notes.map((note) => (
                <div key={note.id} className="rounded-md bg-gray-50 p-3">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.noteText}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {note.createdBy} &middot; {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          {onAddNote && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || !newNote.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Add'}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
