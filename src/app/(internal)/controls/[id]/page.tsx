'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import {
  getControl, createControlVersion, deleteControlVersion, publishControlVersion, updateControl,
  listControlFrameworkMappings, createControlFrameworkMapping, deleteControlFrameworkMapping,
  listControlRiskMappings, createControlRiskMapping, deleteControlRiskMapping,
  listFrameworks, getVersion,
  type ControlDetail, type VersionSummary, type SectionNode,
  type ControlFrameworkMappingItem, type ControlRiskMappingItem,
} from '@/lib/frontend/api'
import Link from 'next/link'
import { useParams } from 'next/navigation'

const statusColors: Record<string, string> = {
  draft: '#f0ad4e',
  active: '#5cb85c',
  deprecated: '#999',
}

interface ClauseInfo {
  id: string
  clause_code: string
  clause_text: string
  section_code: string
  framework_name: string
  version_label: string
}

interface FrameworkOption {
  id: string
  name: string
  versions: VersionOption[]
}

interface VersionOption {
  id: string
  version_label: string
  clauses: ClauseOption[]
}

interface ClauseOption {
  id: string
  clause_code: string
  clause_text: string
  section_code: string
}

export default function ControlDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const canMutate = user.role !== 'Read-only Auditor'

  const [control, setControl] = useState<ControlDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fwMappings, setFwMappings] = useState<ControlFrameworkMappingItem[]>([])
  const [riskMappings, setRiskMappings] = useState<ControlRiskMappingItem[]>([])
  const [clauseMap, setClauseMap] = useState<Map<string, ClauseInfo>>(new Map())
  const [loadingClauses, setLoadingClauses] = useState(true)

  const [showAddFw, setShowAddFw] = useState(false)
  const [showAddRisk, setShowAddRisk] = useState(false)

  const [frameworks, setFrameworks] = useState<FrameworkOption[]>([])
  const [selectedFw, setSelectedFw] = useState('')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [selectedClause, setSelectedClause] = useState('')
  const [riskId, setRiskId] = useState('')
  const [adding, setAdding] = useState(false)

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

  const loadMappings = useCallback(async () => {
    try {
      const [fwRes, riskRes] = await Promise.all([
        listControlFrameworkMappings({ control_id: id }, user.id),
        listControlRiskMappings({ control_id: id }, user.id),
      ])
      setFwMappings(fwRes.data)
      setRiskMappings(riskRes.data)
    } catch (err) {
      console.warn('Failed to load mappings:', err)
    }
  }, [id])

  const fetchVersions = useCallback(async (frameworkId: string): Promise<{ id: string; version_label: string }[]> => {
    try {
      const res = await fetch(`/api/v1/internal/frameworks/${frameworkId}/versions`, {
        headers: { 'Content-Type': 'application/json', 'x-internal-user-id': user.id },
      })
      if (!res.ok) return []
      const body = await res.json()
      return body.data || []
    } catch (err) {
      console.warn('Failed to fetch versions:', err)
      return []
    }
  }, [user.id])

  const loadClauseData = useCallback(async () => {
    setLoadingClauses(true)
    try {
      const fwRes = await listFrameworks({ page_size: 200 }, user.id)
      const map = new Map<string, ClauseInfo>()

      await Promise.all(fwRes.data.map(async (fw) => {
        const versions = await fetchVersions(fw.id)
        await Promise.all(versions.map(async (ver) => {
          try {
            const verRes = await getVersion(fw.id, ver.id, user.id)
            flattenClauses(verRes.data.sections, fw.name, verRes.data.version_label, map)
          } catch (err) {
            console.warn(`Failed to load version ${ver.id} for framework ${fw.id}:`, err)
          }
        }))
      }))

      setClauseMap(map)
    } catch (err) {
      console.warn('Failed to load clause data:', err)
    } finally {
      setLoadingClauses(false)
    }
  }, [fetchVersions])

  const loadFrameworksForPicker = useCallback(async () => {
    try {
      const fwRes = await listFrameworks({ page_size: 200 }, user.id)
      const options: FrameworkOption[] = []

      await Promise.all(fwRes.data.map(async (fw) => {
        const versions = await fetchVersions(fw.id)
        const versionOptions: VersionOption[] = []

        await Promise.all(versions.map(async (ver) => {
          try {
            const verRes = await getVersion(fw.id, ver.id, user.id)
            const clauses = flattenClauseOptions(verRes.data.sections)
            if (clauses.length > 0) {
              versionOptions.push({ id: ver.id, version_label: verRes.data.version_label, clauses })
            }
          } catch (err) {
            console.warn(`Failed to load version ${ver.id} for framework ${fw.id}:`, err)
          }
        }))

        if (versionOptions.length > 0) {
          options.push({ id: fw.id, name: fw.name, versions: versionOptions })
        }
      }))

      setFrameworks(options)
    } catch (err) {
      console.warn('Failed to load frameworks for picker:', err)
    }
  }, [fetchVersions, user.id])

  useEffect(() => {
    load()
    loadMappings()
    loadClauseData()
  }, [load, loadMappings, loadClauseData])

  function flattenClauses(
    sections: SectionNode[],
    fwName: string,
    verLabel: string,
    map: Map<string, ClauseInfo>,
  ) {
    for (const section of sections) {
      for (const clause of section.clauses) {
        map.set(clause.id, {
          id: clause.id,
          clause_code: clause.clause_code,
          clause_text: clause.clause_text,
          section_code: section.section_code,
          framework_name: fwName,
          version_label: verLabel,
        })
      }
      flattenClauses(section.child_sections, fwName, verLabel, map)
    }
  }

  function flattenClauseOptions(sections: SectionNode[]): ClauseOption[] {
    const result: ClauseOption[] = []
    for (const section of sections) {
      for (const clause of section.clauses) {
        result.push({ id: clause.id, clause_code: clause.clause_code, clause_text: clause.clause_text, section_code: section.section_code })
      }
      result.push(...flattenClauseOptions(section.child_sections))
    }
    return result
  }

  const handleAddFwMapping = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClause) return
    setAdding(true)
    try {
      await createControlFrameworkMapping({ control_id: id, framework_clause_id: selectedClause }, user.id)
      setShowAddFw(false)
      setSelectedFw('')
      setSelectedVersion('')
      setSelectedClause('')
      await loadMappings()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create mapping')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteFwMapping = async (mappingId: string) => {
    if (!confirm('Remove this framework clause mapping?')) return
    try {
      await deleteControlFrameworkMapping(mappingId, user.id)
      await loadMappings()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete mapping')
    }
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const handleAddRiskMapping = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = riskId.trim()
    if (!trimmed) return
    if (!UUID_RE.test(trimmed)) {
      alert('Please enter a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)')
      return
    }
    setAdding(true)
    try {
      await createControlRiskMapping({ control_id: id, risk_id: trimmed }, user.id)
      setShowAddRisk(false)
      setRiskId('')
      await loadMappings()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create mapping')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteRiskMapping = async (mappingId: string) => {
    if (!confirm('Remove this risk mapping?')) return
    try {
      await deleteControlRiskMapping(mappingId, user.id)
      await loadMappings()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete mapping')
    }
  }

  const openAddFwModal = () => {
    setSelectedFw('')
    setSelectedVersion('')
    setSelectedClause('')
    setShowAddFw(true)
    loadFrameworksForPicker()
  }

  const selectedFwObj = frameworks.find(f => f.id === selectedFw)
  const selectedVerObj = selectedFwObj?.versions.find(v => v.id === selectedVersion)

  if (loading) return <p style={{ color: '#666' }}>Loading control...</p>

  if (error) {
    return (
      <div>
        <div style={{ padding: 12, background: '#fff0f0', border: '1px solid #fcc', borderRadius: 4 }}>
          <p style={{ margin: 0, color: '#c00', fontSize: 14 }}>{error}</p>
        </div>
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
          <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>
            <span style={{ color: '#666', fontWeight: 400 }}>{control.control_code}</span>
            {' '}{control.title}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>{control.description || 'No description'}</p>
          <p style={{ margin: '2px 0 0', color: '#999', fontSize: 12 }}>{control.version_count} version(s)</p>
        </div>
      </div>

      {}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Framework Clause Mappings</h2>
          {canMutate && (
            <button onClick={openAddFwModal} style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
              + Add Mapping
            </button>
          )}
        </div>

        {fwMappings.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>
            <p style={{ fontSize: 14, margin: 0 }}>No framework clause mappings yet.</p>
          </div>
        )}

        {fwMappings.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#666' }}>Framework</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#666' }}>Section</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#666' }}>Clause</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#666' }}>Clause Text</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#666' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fwMappings.map((m) => {
                const info = loadingClauses ? null : clauseMap.get(m.framework_clause_id)
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px', fontSize: 14, color: '#333' }}>{info?.framework_name || <span style={{ color: '#999' }}>{m.framework_clause_id.slice(0, 8)}...</span>}</td>
                    <td style={{ padding: '8px 12px', fontSize: 14, color: '#333' }}>{info?.section_code || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 14, color: '#333', fontWeight: 500 }}>{info?.clause_code || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: '#666', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info?.clause_text || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      {canMutate && (
                        <button onClick={() => handleDeleteFwMapping(m.id)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Risk Mappings</h2>
          {canMutate && (
            <button onClick={() => { setRiskId(''); setShowAddRisk(true) }} style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
              + Add Mapping
            </button>
          )}
        </div>

        {riskMappings.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>
            <p style={{ fontSize: 14, margin: 0 }}>No risk mappings yet.</p>
          </div>
        )}

        {riskMappings.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#666' }}>Risk ID</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#666' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {riskMappings.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 12px', fontSize: 14, color: '#333', fontFamily: 'monospace' }}>{m.risk_id}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    {canMutate && (
                      <button onClick={() => handleDeleteRiskMapping(m.id)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {}
      {showAddFw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleAddFwMapping} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 520, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Add Framework Clause Mapping</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Framework *</label>
              <select value={selectedFw} onChange={(e) => { setSelectedFw(e.target.value); setSelectedVersion(''); setSelectedClause('') }} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
                <option value="">Select a framework...</option>
                {frameworks.map((fw) => (
                  <option key={fw.id} value={fw.id}>{fw.name}</option>
                ))}
              </select>
            </div>

            {selectedFw && selectedFwObj && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Version *</label>
                <select value={selectedVersion} onChange={(e) => { setSelectedVersion(e.target.value); setSelectedClause('') }} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">Select a version...</option>
                  {selectedFwObj.versions.map((v) => (
                    <option key={v.id} value={v.id}>{v.version_label} ({v.clauses.length} clauses)</option>
                  ))}
                </select>
              </div>
            )}

            {selectedVersion && selectedVerObj && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Clause *</label>
                <select value={selectedClause} onChange={(e) => setSelectedClause(e.target.value)} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">Select a clause...</option>
                  {selectedVerObj.clauses.map((c) => (
                    <option key={c.id} value={c.id}>[{c.section_code}] {c.clause_code} — {c.clause_text.length > 60 ? c.clause_text.slice(0, 60) + '...' : c.clause_text}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAddFw(false)} disabled={adding} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button type="submit" disabled={adding || !selectedClause} style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: adding || !selectedClause ? 'default' : 'pointer', fontSize: 14, opacity: adding || !selectedClause ? 0.6 : 1 }}>
                {adding ? 'Adding...' : 'Add Mapping'}
              </button>
            </div>
          </form>
        </div>
      )}

      {}
      {showAddRisk && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleAddRiskMapping} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Add Risk Mapping</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Risk ID *</label>
              <input
                value={riskId}
                onChange={(e) => setRiskId(e.target.value)}
                placeholder="Enter risk UUID..."
                required
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#999' }}>
                Enter the UUID of the risk record to associate with this control.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowAddRisk(false)} disabled={adding} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button type="submit" disabled={adding || !riskId.trim()} style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: adding || !riskId.trim() ? 'default' : 'pointer', fontSize: 14, opacity: adding || !riskId.trim() ? 0.6 : 1 }}>
                {adding ? 'Adding...' : 'Add Mapping'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
