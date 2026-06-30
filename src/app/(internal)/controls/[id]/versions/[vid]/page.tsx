'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import {
  getControlVersion, updateControlVersion,
  createImplementationStep, updateImplementationStep, deleteImplementationStep,
  publishControlVersion,
  type ControlVersionDetail, type ImplementationStepItem,
} from '@/lib/frontend/api'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const statusColors: Record<string, string> = {
  draft: '#f0ad4e',
  active: '#5cb85c',
  deprecated: '#999',
}

export default function ControlVersionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const controlId = params.id as string
  const versionId = params.vid as string
  const { user } = useAuth()
  const canMutate = user.role !== 'Read-only Auditor'

  const [version, setVersion] = useState<ControlVersionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const [editingMeta, setEditingMeta] = useState(false)
  const [metaLabel, setMetaLabel] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [metaDate, setMetaDate] = useState('')

  const [addingStep, setAddingStep] = useState(false)
  const [stepCode, setStepCode] = useState('')
  const [stepTitle, setStepTitle] = useState('')
  const [stepDesc, setStepDesc] = useState('')
  const [stepSort, setStepSort] = useState('0')

  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [editStepCode, setEditStepCode] = useState('')
  const [editStepTitle, setEditStepTitle] = useState('')
  const [editStepDesc, setEditStepDesc] = useState('')
  const [editStepSort, setEditStepSort] = useState('0')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getControlVersion(controlId, versionId, user.id)
      setVersion(res.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load version')
    } finally {
      setLoading(false)
    }
  }, [controlId, versionId])

  useEffect(() => {
    load()
  }, [load])

  const openMetaEdit = () => {
    if (!version) return
    setMetaLabel(version.version_label)
    setMetaDesc(version.description || '')
    setMetaDate(version.effective_date ? version.effective_date.slice(0, 10) : '')
    setEditingMeta(true)
  }

  const handleMetaSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!version) return
    try {
      const res = await updateControlVersion(controlId, versionId, {
        version_label: metaLabel.trim() || undefined,
        description: metaDesc || undefined,
        effective_date: metaDate || undefined,
      }, user.id)
      setEditingMeta(false)
      if ((res.data as Record<string, unknown>).cloned_from_version_id) {
        const newId = (res.data as Record<string, unknown>).cloned_from_version_id as string
        setActionMsg('Version was cloned. Redirecting to new draft...')
        setTimeout(() => router.push(`/controls/${controlId}/versions/${newId}`), 1000)
      } else {
        await load()
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update version')
    }
  }

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createImplementationStep(controlId, versionId, {
        step_code: stepCode.trim(),
        title: stepTitle.trim(),
        description: stepDesc.trim() || undefined,
        sort_order: parseInt(stepSort, 10) || 0,
      }, user.id)
      setAddingStep(false)
      setStepCode('')
      setStepTitle('')
      setStepDesc('')
      setStepSort('0')
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create implementation step')
    }
  }

  const handleEditStep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStep) return
    try {
      await updateImplementationStep(controlId, versionId, editingStep, {
        step_code: editStepCode.trim() || undefined,
        title: editStepTitle.trim() || undefined,
        description: editStepDesc || undefined,
        sort_order: parseInt(editStepSort, 10) || 0,
      }, user.id)
      setEditingStep(null)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update implementation step')
    }
  }

  const handleDeleteStep = async (step: ImplementationStepItem) => {
    if (!confirm(`Delete step "${step.step_code}"?`)) return
    try {
      await deleteImplementationStep(controlId, versionId, step.id, user.id)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete step')
    }
  }

  const handlePublish = async () => {
    if (!confirm('Publish this version? This cannot be undone.')) return
    try {
      await publishControlVersion(controlId, versionId, user.id)
      setActionMsg('Version published.')
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to publish')
    }
  }

  if (loading) return <p style={{ color: '#666' }}>Loading version...</p>

  if (error) {
    return (
      <div>
        <div style={{ padding: 12, background: '#fff0f0', border: '1px solid #fcc', borderRadius: 4 }}>
          <p style={{ margin: 0, color: '#c00', fontSize: 14 }}>{error}</p>
        </div>
        <Link href={`/controls/${controlId}`} style={{ color: '#1a1a2e', fontSize: 14 }}>Back to control</Link>
      </div>
    )
  }

  if (!version) return null

  const steps = version.implementation_steps || []

  return (
    <div>
      <Link href={`/controls/${controlId}`} style={{ color: '#666', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>&larr; Back to control</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>
            Version {version.version_label}
            <span style={{ display: 'inline-block', marginLeft: 10, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, color: '#fff', background: statusColors[version.status] || '#999', verticalAlign: 'middle' }}>
              {version.status}
            </span>
          </h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>{version.description || 'No description'}</p>
          {version.effective_date && <p style={{ margin: '2px 0 0', color: '#999', fontSize: 12 }}>Effective: {new Date(version.effective_date).toLocaleDateString()}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canMutate && version.status === 'draft' && (
            <>
              <button onClick={openMetaEdit} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Edit Metadata
              </button>
              <button onClick={handlePublish} style={{ padding: '8px 16px', background: '#5cb85c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Publish
              </button>
            </>
          )}
        </div>
      </div>

      {actionMsg && (
        <div style={{ padding: 10, background: '#f0fff0', border: '1px solid #cfc', borderRadius: 4, marginBottom: 16, fontSize: 14 }}>
          {actionMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Implementation Steps</h2>
        {canMutate && version.status === 'draft' && (
          <button onClick={() => setAddingStep(true)} style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
            + Add Step
          </button>
        )}
      </div>

      {steps.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
          <p style={{ fontSize: 16, margin: '0 0 8px' }}>No implementation steps yet</p>
          <p style={{ fontSize: 13, margin: 0 }}>Add implementation steps to define the control requirements. At least one step is needed before publishing.</p>
        </div>
      )}

      {steps.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <thead>
            <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #eee' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', width: 60 }}>Order</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', width: 100 }}>Code</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Title</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Description</th>
              {canMutate && version.status === 'draft' && (
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', width: 100 }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {steps
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((step) => (
                <tr key={step.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: '#888' }}>{step.sort_order}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500, fontSize: 14 }}>{step.step_code}</td>
                  <td style={{ padding: '10px 16px', fontSize: 14 }}>{step.title}</td>
                  <td style={{ padding: '10px 16px', color: '#666', fontSize: 14 }}>{step.description || '\u2014'}</td>
                  {canMutate && version.status === 'draft' && (
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 13 }}>
                      <button
                        onClick={() => {
                          setEditingStep(step.id)
                          setEditStepCode(step.step_code)
                          setEditStepTitle(step.title)
                          setEditStepDesc(step.description || '')
                          setEditStepSort(String(step.sort_order))
                        }}
                        style={{ background: 'none', border: 'none', color: '#1a1a2e', cursor: 'pointer', fontSize: 13, padding: 0, marginRight: 12 }}
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDeleteStep(step)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {editingMeta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleMetaSave} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Edit Version Metadata</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Version Label</label>
              <input value={metaLabel} onChange={(e) => setMetaLabel(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Effective Date</label>
              <input type="date" value={metaDate} onChange={(e) => setMetaDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
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

      {addingStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleAddStep} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Add Implementation Step</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Step Code *</label>
              <input value={stepCode} onChange={(e) => setStepCode(e.target.value)} placeholder="e.g. 1.1" required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title *</label>
              <input value={stepTitle} onChange={(e) => setStepTitle(e.target.value)} placeholder="e.g. Define access control policy" required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={stepDesc} onChange={(e) => setStepDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sort Order</label>
              <input type="number" value={stepSort} onChange={(e) => setStepSort(e.target.value)} min="0" style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setAddingStep(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Add Step
              </button>
            </div>
          </form>
        </div>
      )}

      {editingStep && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleEditStep} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Edit Implementation Step</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Step Code</label>
              <input value={editStepCode} onChange={(e) => setEditStepCode(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title</label>
              <input value={editStepTitle} onChange={(e) => setEditStepTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={editStepDesc} onChange={(e) => setEditStepDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Sort Order</label>
              <input type="number" value={editStepSort} onChange={(e) => setEditStepSort(e.target.value)} min="0" style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditingStep(null)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
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
