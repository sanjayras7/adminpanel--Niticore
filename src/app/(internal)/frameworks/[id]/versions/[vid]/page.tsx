'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/frontend/auth-context'
import {
  getVersion, updateVersion,
  createSection, updateSection, deleteSection,
  createClause, updateClause, deleteClause,
  publishVersion,
  type VersionDetail, type SectionNode, type ClauseItem,
} from '@/lib/frontend/api'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const statusColors: Record<string, string> = {
  draft: '#f0ad4e',
  active: '#5cb85c',
  deprecated: '#999',
}

export default function VersionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const frameworkId = params.id as string
  const versionId = params.vid as string
  const { canMutate } = useAuth()

  const [version, setVersion] = useState<VersionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const [editingMeta, setEditingMeta] = useState(false)
  const [metaLabel, setMetaLabel] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [metaDate, setMetaDate] = useState('')

  const [addingSection, setAddingSection] = useState(false)
  const [sectionCode, setSectionCode] = useState('')
  const [sectionTitle, setSectionTitle] = useState('')
  const [sectionDesc, setSectionDesc] = useState('')
  const [sectionParent, setSectionParent] = useState('')

  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editSectionCode, setEditSectionCode] = useState('')
  const [editSectionTitle, setEditSectionTitle] = useState('')
  const [editSectionDesc, setEditSectionDesc] = useState('')

  const [addingClause, setAddingClause] = useState<string | null>(null)
  const [clauseCode, setClauseCode] = useState('')
  const [clauseText, setClauseText] = useState('')

  const [editingClause, setEditingClause] = useState<string | null>(null)
  const [editClauseCode, setEditClauseCode] = useState('')
  const [editClauseText, setEditClauseText] = useState('')
  const [editClauseSection, setEditClauseSection] = useState('')

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getVersion(frameworkId, versionId)
      setVersion(res.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load version')
    } finally {
      setLoading(false)
    }
  }, [frameworkId, versionId])

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
      const res = await updateVersion(frameworkId, versionId, {
        version_label: metaLabel.trim() || undefined,
        description: metaDesc || undefined,
        effective_date: metaDate || undefined,
      })
      setEditingMeta(false)
      if ((res.data as Record<string, unknown>).cloned_from_version_id) {
        const newId = (res.data as Record<string, unknown>).cloned_from_version_id as string
        setActionMsg(`Version was published/cloned. Redirecting to new draft...`)
        setTimeout(() => router.push(`/frameworks/${frameworkId}/versions/${newId}`), 1000)
      } else {
        await load()
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update version')
    }
  }

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await createSection(frameworkId, versionId, {
        section_code: sectionCode.trim(),
        title: sectionTitle.trim(),
        description: sectionDesc.trim() || undefined,
        parent_section_id: sectionParent || undefined,
      })
      setAddingSection(false)
      setSectionCode('')
      setSectionTitle('')
      setSectionDesc('')
      setSectionParent('')
      if ((res as unknown as Record<string, unknown>).cloned_version_id) {
        const newId = (res as unknown as Record<string, unknown>).cloned_version_id as string
        router.push(`/frameworks/${frameworkId}/versions/${newId}`)
        return
      }
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create section')
    }
  }

  const handleEditSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSection) return
    try {
      const res = await updateSection(frameworkId, versionId, editingSection, {
        section_code: editSectionCode.trim() || undefined,
        title: editSectionTitle.trim() || undefined,
        description: editSectionDesc || undefined,
      })
      setEditingSection(null)
      if ((res as unknown as Record<string, unknown>).cloned_version_id) {
        const newId = (res as unknown as Record<string, unknown>).cloned_version_id as string
        router.push(`/frameworks/${frameworkId}/versions/${newId}`)
        return
      }
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update section')
    }
  }

  const handleDeleteSection = async (sid: string, code: string) => {
    if (!confirm(`Delete section "${code}"?`)) return
    try {
      await deleteSection(frameworkId, versionId, sid)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete section')
    }
  }

  const handleAddClause = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addingClause) return
    try {
      const res = await createClause(frameworkId, versionId, addingClause, {
        clause_code: clauseCode.trim(),
        clause_text: clauseText.trim(),
      })
      setAddingClause(null)
      setClauseCode('')
      setClauseText('')
      if ((res as unknown as Record<string, unknown>).cloned_version_id) {
        const newId = (res as unknown as Record<string, unknown>).cloned_version_id as string
        router.push(`/frameworks/${frameworkId}/versions/${newId}`)
        return
      }
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create clause')
    }
  }

  const handleEditClause = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClause || !editClauseSection) return
    try {
      const res = await updateClause(frameworkId, versionId, editClauseSection, editingClause, {
        clause_code: editClauseCode.trim() || undefined,
        clause_text: editClauseText.trim() || undefined,
      })
      setEditingClause(null)
      setEditClauseSection('')
      if ((res as unknown as Record<string, unknown>).cloned_version_id) {
        const newId = (res as unknown as Record<string, unknown>).cloned_version_id as string
        router.push(`/frameworks/${frameworkId}/versions/${newId}`)
        return
      }
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update clause')
    }
  }

  const handleDeleteClause = async (sid: string, cid: string) => {
    if (!confirm('Delete this clause?')) return
    try {
      await deleteClause(frameworkId, versionId, sid, cid)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete clause')
    }
  }

  const handlePublish = async () => {
    if (!confirm('Publish this version?')) return
    try {
      await publishVersion(frameworkId, versionId)
      setActionMsg('Version published.')
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to publish')
    }
  }

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderSection = (section: SectionNode, depth: number = 0) => {
    const isCollapsed = collapsed.has(section.id)
    return (
      <div key={section.id} style={{ marginLeft: depth * 20, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: depth === 0 ? '#f9f9f9' : '#fff', border: '1px solid #e0e0e0', borderRadius: 4 }}>
          <button
            onClick={() => toggleCollapse(section.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontSize: 12, color: '#666' }}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', minWidth: 80 }}>{section.section_code}</span>
          <span style={{ fontSize: 14, flex: 1 }}>{section.title}</span>
          {section.description && <span style={{ fontSize: 12, color: '#888', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{section.description}</span>}
          {canMutate && version?.status === 'draft' && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <button
                onClick={() => {
                  setEditingSection(section.id)
                  setEditSectionCode(section.section_code)
                  setEditSectionTitle(section.title)
                  setEditSectionDesc(section.description || '')
                }}
                style={{ background: 'none', border: 'none', color: '#1a1a2e', cursor: 'pointer', fontSize: 12, padding: 0 }}
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteSection(section.id, section.section_code)}
                style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 12, padding: 0 }}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div style={{ marginTop: 4 }}>
            {section.clauses.map((clause) => (
              <div key={clause.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 12px 6px 40px', borderLeft: '2px solid #e0e0e0', marginLeft: 12 }}>
                <span style={{ fontWeight: 500, fontSize: 12, color: '#666', minWidth: 80 }}>{clause.clause_code}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{clause.clause_text}</span>
                {canMutate && version?.status === 'draft' && (
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        setEditingClause(clause.id)
                        setEditClauseSection(section.id)
                        setEditClauseCode(clause.clause_code)
                        setEditClauseText(clause.clause_text)
                      }}
                      style={{ background: 'none', border: 'none', color: '#1a1a2e', cursor: 'pointer', fontSize: 12, padding: 0 }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClause(section.id, clause.id)}
                      style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 12, padding: 0 }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}

            {canMutate && version?.status === 'draft' && (
              <button
                onClick={() => {
                  setAddingClause(section.id)
                  setClauseCode('')
                  setClauseText('')
                }}
                style={{ margin: '4px 0 4px 40px', background: 'none', border: 'none', color: '#1a1a2e', cursor: 'pointer', fontSize: 12, padding: '4px 0' }}
              >
                + Add clause
              </button>
            )}

            {section.child_sections.map((child) => renderSection(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <p style={{ color: '#666' }}>Loading version...</p>

  if (error) {
    return (
      <div>
        <div style={{ padding: 12, background: '#fff0f0', border: '1px solid #fcc', borderRadius: 4 }}>
          <p style={{ margin: 0, color: '#c00', fontSize: 14 }}>{error}</p>
        </div>
        <Link href={`/frameworks/${frameworkId}`} style={{ color: '#1a1a2e', fontSize: 14 }}>Back to framework</Link>
      </div>
    )
  }

  if (!version) return null

  return (
    <div>
      <Link href={`/frameworks/${frameworkId}`} style={{ color: '#666', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>&larr; Back to framework</Link>

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
        <h2 style={{ fontSize: 18, margin: 0 }}>Sections &amp; Clauses</h2>
        {canMutate && version.status === 'draft' && (
          <button onClick={() => setAddingSection(true)} style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
            + Add Section
          </button>
        )}
      </div>

      {version.sections.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
          <p style={{ fontSize: 16, margin: '0 0 8px' }}>No sections yet</p>
          <p style={{ fontSize: 13, margin: 0 }}>Add sections and clauses to define the framework content.</p>
        </div>
      )}

      {version.sections.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: 12 }}>
          {version.sections.map((section) => renderSection(section))}
        </div>
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

      {addingSection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleAddSection} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Add Section</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Section Code *</label>
              <input value={sectionCode} onChange={(e) => setSectionCode(e.target.value)} placeholder="e.g. AC-1" required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title *</label>
              <input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="e.g. Access Control" required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={sectionDesc} onChange={(e) => setSectionDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Parent Section (optional, for child sections)</label>
              <select value={sectionParent} onChange={(e) => setSectionParent(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
                <option value="">None (top-level)</option>
                {version.sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.section_code} - {s.title}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setAddingSection(false)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Add Section
              </button>
            </div>
          </form>
        </div>
      )}

      {editingSection && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleEditSection} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Edit Section</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Section Code</label>
              <input value={editSectionCode} onChange={(e) => setEditSectionCode(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Title</label>
              <input value={editSectionTitle} onChange={(e) => setEditSectionTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={editSectionDesc} onChange={(e) => setEditSectionDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditingSection(null)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {addingClause && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleAddClause} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Add Clause</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Clause Code *</label>
              <input value={clauseCode} onChange={(e) => setClauseCode(e.target.value)} placeholder="e.g. AC-1.a" required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Clause Text *</label>
              <textarea value={clauseText} onChange={(e) => setClauseText(e.target.value)} rows={3} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setAddingClause(null)} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button type="submit" style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Add Clause
              </button>
            </div>
          </form>
        </div>
      )}

      {editingClause && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleEditClause} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Edit Clause</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Clause Code</label>
              <input value={editClauseCode} onChange={(e) => setEditClauseCode(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Clause Text</label>
              <textarea value={editClauseText} onChange={(e) => setEditClauseText(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setEditingClause(null); setEditClauseSection('') }} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
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
