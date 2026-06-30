'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { getControl, createControlVersion, deleteControlVersion, publishControlVersion, updateControl, type ControlDetail, type VersionSummary } from '@/lib/frontend/api'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const statusColors: Record<string, string> = {
  draft: '#f0ad4e',
  active: '#5cb85c',
  deprecated: '#999',
}

export default function ControlDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const canMutate = user.role !== 'Read-only Auditor'
  const [control, setControl] = useState<ControlDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [versionLabel, setVersionLabel] = useState('')
  const [versionDesc, setVersionDesc] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const [editingMeta, setEditingMeta] = useState(false)
  const [metaCode, setMetaCode] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getControl(id, user.id)
      setControl(res.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load control')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const openMetaEdit = () => {
    if (!control) return
    setMetaCode(control.control_code)
    setMetaTitle(control.title)
    setMetaDesc(control.description || '')
    setEditingMeta(true)
  }

  const handleMetaSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!control) return
    try {
      await updateControl(id, {
        control_code: metaCode.trim() || undefined,
        title: metaTitle.trim() || undefined,
        description: metaDesc || undefined,
      }, user.id)
      setEditingMeta(false)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update control')
    }
  }

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!versionLabel.trim()) return
    setCreating(true)
    try {
      await createControlVersion(id, {
        version_label: versionLabel.trim(),
        description: versionDesc.trim() || undefined,
        effective_date: effectiveDate || undefined,
      }, user.id)
      setShowCreate(false)
      setVersionLabel('')
      setVersionDesc('')
      setEffectiveDate('')
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create version')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteVersion = async (v: VersionSummary) => {
    if (!confirm(`Delete version "${v.version_label}"?`)) return
    try {
      await deleteControlVersion(id, v.id, user.id)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete version')
    }
  }

  const handlePublish = async (v: VersionSummary) => {
    if (!confirm(`Publish version "${v.version_label}"? This cannot be undone.`)) return
    try {
      await publishControlVersion(id, v.id, user.id)
      setActionMsg(`Version "${v.version_label}" published.`)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to publish version')
    }
  }

  if (loading) return <p style={{ color: '#666' }}>Loading control...</p>

  if (error) {
    return (
      <div style={{ padding: 12, background: '#fff0f0', border: '1px solid #fcc', borderRadius: 4 }}>
        <p style={{ margin: 0, color: '#c00', fontSize: 14 }}>{error}</p>
        <Link href="/controls" style={{ color: '#1a1a2e', fontSize: 14 }}>Back to controls</Link>
      </div>
    )
  }

  if (!control) return null

  return (
    <div>
      <Link href="/controls" style={{ color: '#666', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>&larr; Back to controls</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>{control.control_code}: {control.title}</h1>
          <p style={{ margin: 0, color: '#666', fontSize: 14 }}>{control.description || 'No description'}</p>
          <p style={{ margin: '4px 0 0', color: '#999', fontSize: 12 }}>{control.version_count} version(s)</p>
        </div>
        {canMutate && (
          <button onClick={openMetaEdit} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
            Edit Control
          </button>
        )}
      </div>

      {actionMsg && (
        <div style={{ padding: 10, background: '#f0fff0', border: '1px solid #cfc', borderRadius: 4, marginBottom: 16, fontSize: 14 }}>
          {actionMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Versions</h2>
        {canMutate && (
          <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
            + New Version
          </button>
        )}
      </div>

      {control.versions.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
          <p style={{ fontSize: 16, margin: '0 0 8px' }}>No versions yet</p>
          {canMutate && <p style={{ fontSize: 13, margin: 0 }}>Create the first version to add implementation steps.</p>}
        </div>
      )}

      {control.versions.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <thead>
            <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #eee' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Label</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Description</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Effective Date</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {control.versions.map((v) => (
              <tr key={v.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 16px' }}>
                  <Link href={`/controls/${id}/versions/${v.id}`} style={{ color: '#1a1a2e', textDecoration: 'none', fontWeight: 500 }}>
                    {v.version_label}
                  </Link>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, color: '#fff', background: statusColors[v.status] || '#999' }}>
                    {v.status}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', color: '#666', fontSize: 14 }}>{v.description || '\u2014'}</td>
                <td style={{ padding: '10px 16px', color: '#666', fontSize: 14 }}>{v.effective_date ? new Date(v.effective_date).toLocaleDateString() : '\u2014'}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13 }}>
                  <Link href={`/controls/${id}/versions/${v.id}`} style={{ color: '#1a1a2e', textDecoration: 'none', marginRight: canMutate ? 8 : 0 }}>
                    View
                  </Link>
                  {canMutate && v.status === 'draft' && (
                    <>
                      <button onClick={() => handlePublish(v)} style={{ background: 'none', border: 'none', color: '#5cb85c', cursor: 'pointer', fontSize: 13, padding: 0, marginRight: 8 }}>
                        Publish
                      </button>
                      <button onClick={() => handleDeleteVersion(v)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                        Delete
                      </button>
                    </>
                  )}
                  {canMutate && v.status !== 'draft' && (
                    <span style={{ color: '#ccc' }}>\u2014</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleCreateVersion} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Create Version</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Version Label *</label>
              <input value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="e.g. 1.0" required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={versionDesc} onChange={(e) => setVersionDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Effective Date</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)} disabled={creating} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button type="submit" disabled={creating} style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: creating ? 'default' : 'pointer', fontSize: 14, opacity: creating ? 0.6 : 1 }}>
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingMeta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleMetaSave} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Edit Control</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Control Code</label>
              <input value={metaCode} onChange={(e) => setMetaCode(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title</label>
              <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditingMeta(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
