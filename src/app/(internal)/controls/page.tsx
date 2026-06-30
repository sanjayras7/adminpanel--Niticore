'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { listControls, type ControlItem } from '@/lib/frontend/api'
import Link from 'next/link'

export default function ControlListPage() {
  const { user } = useAuth()
  const canMutate = user.role !== 'Read-only Auditor'
  const [controls, setControls] = useState<ControlItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pageSize = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listControls({ search: search || undefined, page, page_size: pageSize }, user.id)
      setControls(res.data)
      setTotal(res.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load controls')
      setControls([])
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Controls</h1>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search controls by code or title..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{ width: '100%', maxWidth: 400, padding: '8px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      {loading && <p style={{ color: '#666' }}>Loading controls...</p>}

      {error && (
        <div style={{ padding: 12, background: '#fff0f0', border: '1px solid #fcc', borderRadius: 4, marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#c00', fontSize: 14 }}>{error}</p>
        </div>
      )}

      {!loading && !error && controls.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888', background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
          <p style={{ fontSize: 16, margin: '0 0 8px' }}>No controls found</p>
          {search ? (
            <p style={{ fontSize: 13, margin: 0 }}>Try a different search term.</p>
          ) : (
            <p style={{ fontSize: 13, margin: 0 }}>No controls have been created yet.</p>
          )}
        </div>
      )}

      {!loading && !error && controls.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <thead>
              <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Code</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Title</th>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Description</th>
                <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Versions</th>
                <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((ctrl) => (
                <tr key={ctrl.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                    <Link href={`/controls/${ctrl.id}`} style={{ color: '#1a1a2e', textDecoration: 'none' }}>
                      {ctrl.control_code}
                    </Link>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#333', fontSize: 14 }}>{ctrl.title}</td>
                  <td style={{ padding: '10px 16px', color: '#666', fontSize: 14 }}>{ctrl.description || '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 14 }}>{ctrl.version_count}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <Link href={`/controls/${ctrl.id}`} style={{ color: '#1a1a2e', textDecoration: 'none', fontSize: 13 }}>
                      View
                    </Link>
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
    </div>
  )
}
