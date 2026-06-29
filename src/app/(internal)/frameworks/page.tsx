'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/frontend/auth-context'
import { listFrameworks, createFramework, deleteFramework, type FrameworkItem } from '@/lib/frontend/api'
import Link from 'next/link'

export default function FrameworkListPage() {
  const { canMutate } = useAuth()
  const [frameworks, setFrameworks] = useState<FrameworkItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const pageSize = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listFrameworks({ search: search || undefined, page, page_size: pageSize })
      setFrameworks(res.data)
      setTotal(res.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load frameworks')
      setFrameworks([])
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) return
    setCreating(true)
    try {
      await createFramework({ name: createName.trim(), description: createDesc.trim() || undefined })
      setShowCreate(false)
      setCreateName('')
      setCreateDesc('')
      setPage(1)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create framework')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete framework "${name}"? This cannot be undone.`)) return
    try {
      await deleteFramework(id)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete framework')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Frameworks</h1>
        {canMutate && (
          <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
            + New Framework
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search frameworks by name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{ width: '100%', maxWidth: 400, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      {loading && <p style={{ color: '#666' }}>Loading frameworks...</p>}

      {error && (
        <div style={{ padding: 12, background: '#fff0f0', border: '1px solid #fcc', borderRadius: 4, marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#c00', fontSize: 14 }}>{error}</p>
        </div>
      )}

      {!loading && !error && frameworks.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
          <p style={{ fontSize: 16, margin: '0 0 8px' }}>No frameworks found</p>
          {search ? (
            <p style={{ fontSize: 13, margin: 0 }}>Try a different search term.</p>
          ) : (
            <p style={{ fontSize: 13, margin: 0 }}>Create your first framework to get started.</p>
          )}
        </div>
      )}

      {!loading && !error && frameworks.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <thead>
              <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Description</th>
                <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Versions</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {frameworks.map((fw) => (
                <tr key={fw.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <Link href={`/frameworks/${fw.id}`} style={{ color: '#1a1a2e', textDecoration: 'none', fontWeight: 500 }}>
                      {fw.name}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#666', fontSize: 14 }}>{fw.description || '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 14 }}>{fw.version_count}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <Link href={`/frameworks/${fw.id}`} style={{ color: '#1a1a2e', textDecoration: 'none', fontSize: 13, marginRight: canMutate ? 12 : 0 }}>
                      View
                    </Link>
                    {canMutate && (
                      <button onClick={() => handleDelete(fw.id, fw.name)} style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, alignItems: 'center' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', background: page <= 1 ? '#eee' : '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: page <= 1 ? 'default' : 'pointer', fontSize: 13 }}>
                Previous
              </button>
              <span style={{ fontSize: 13, color: '#666' }}>Page {page} of {totalPages} ({total} total)</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', background: page >= totalPages ? '#eee' : '#fff', border: '1px solid #ccc', borderRadius: 4, cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 13 }}>
                Next
              </button>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleCreate} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 16px' }}>Create Framework</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Name *</label>
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
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
    </div>
  )
}
