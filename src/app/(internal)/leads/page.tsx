'use client'

import { useState, useEffect, useCallback } from 'react'
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
  source: string
  status: string
  assigned_owner_id: string | null
  nda_required: boolean
  demo_status: string | null
  contract_status: string | null
  created_at: string
}

interface LeadListResponse {
  data: Lead[]
  total: number
  page: number
  limit: number
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function LeadsPage() {
  const { user } = useAuth()

  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [owner, setOwner] = useState('')
  const [source, setSource] = useState('')
  const [framework, setFramework] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (search.length >= 2) params.set('search', search)
      if (status) params.set('status', status)
      if (owner) params.set('owner', owner)
      if (source) params.set('source', source)
      if (framework) params.set('framework', framework)
      if (createdFrom) params.set('created_from', createdFrom)
      if (createdTo) params.set('created_to', createdTo)

      const res = await fetch(`/api/v1/internal/leads?${params.toString()}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError('You do not have permission to view leads.')
        } else {
          setError('Failed to load leads. Please try again.')
        }
        return
      }

      const body: LeadListResponse = await res.json()
      setLeads(body.data)
      setTotal(body.total)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, status, owner, source, framework, createdFrom, createdTo])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      setPage(1)
      fetchLeads()
    }
  }

  function handleFilterChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setter(e.target.value)
    }
  }

  function applyFilters() {
    setPage(1)
    fetchLeads()
  }

  function clearFilters() {
    setSearch('')
    setStatus('')
    setOwner('')
    setSource('')
    setFramework('')
    setCreatedFrom('')
    setCreatedTo('')
    setPage(1)
  }

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Leads</h1>
        <span style={styles.count}>{total} total</span>
      </div>

      <div style={styles.searchRow}>
        <input
          type="text"
          placeholder="Search by company, contact, email, or domain..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          style={styles.searchInput}
        />
        <button onClick={applyFilters} style={styles.primaryButton}>
          Search
        </button>
      </div>

      <div style={styles.filterRow}>
        <select value={status} onChange={handleFilterChange(setStatus)} style={styles.filterSelect}>
          <option value="">All statuses</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Qualified">Qualified</option>
          <option value="Lost">Lost</option>
        </select>
        <select value={source} onChange={handleFilterChange(setSource)} style={styles.filterSelect}>
          <option value="">All sources</option>
          <option value="Website Form">Website Form</option>
          <option value="Referral">Referral</option>
          <option value="Manual Entry">Manual Entry</option>
          <option value="Import">Import</option>
        </select>
        <input
          type="text"
          placeholder="Owner UUID"
          value={owner}
          onChange={handleFilterChange(setOwner)}
          style={styles.filterInput}
        />
        <input
          type="text"
          placeholder="Framework"
          value={framework}
          onChange={handleFilterChange(setFramework)}
          style={styles.filterInput}
        />
        <input
          type="date"
          value={createdFrom}
          onChange={handleFilterChange(setCreatedFrom)}
          style={styles.filterInput}
          title="Created from"
        />
        <input
          type="date"
          value={createdTo}
          onChange={handleFilterChange(setCreatedTo)}
          style={styles.filterInput}
          title="Created to"
        />
        <button onClick={clearFilters} style={styles.secondaryButton}>
          Clear
        </button>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          {error}
        </div>
      )}

      {loading && (
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
        </div>
      )}

      {!loading && !error && leads.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No leads found matching your criteria.</p>
        </div>
      )}

      {!loading && !error && leads.length > 0 && (
        <>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Company</th>
                  <th style={styles.th}>Contact</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Domain</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Source</th>
                  <th style={styles.th}>Created</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} style={styles.tr}>
                    <td style={styles.td}>
                      <a href={`/internal/leads/${lead.id}`} style={styles.leadLink}>
                        {lead.company_name}
                      </a>
                    </td>
                    <td style={styles.td}>
                      {lead.contact_first_name} {lead.contact_last_name}
                    </td>
                    <td style={styles.td}>{lead.work_email}</td>
                    <td style={styles.td}>{lead.company_domain || '—'}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        ...(lead.status === 'New' ? styles.badgeNew : {}),
                        ...(lead.status === 'Contacted' ? styles.badgeContacted : {}),
                        ...(lead.status === 'Qualified' ? styles.badgeQualified : {}),
                        ...(lead.status === 'Lost' ? styles.badgeLost : {}),
                      }}>
                        {lead.status}
                      </span>
                    </td>
                    <td style={styles.td}>{lead.source}</td>
                    <td style={styles.td}>{formatDate(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.pagination}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={styles.pageButton}
            >
              Previous
            </button>
            <span style={styles.pageInfo}>
              Page {page} of {totalPages} ({total} total)
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={styles.pageButton}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    margin: 0,
    color: '#1a1a1a',
  },
  count: {
    fontSize: 13,
    color: '#888',
  },
  searchRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 6,
    background: '#fff',
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap' as const,
  },
  filterSelect: {
    padding: '6px 10px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 6,
    background: '#fff',
    minWidth: 130,
  },
  filterInput: {
    padding: '6px 10px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 6,
    background: '#fff',
    minWidth: 120,
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
  errorBanner: {
    padding: '12px 16px',
    background: '#FFF0F0',
    border: '1px solid #FFCDD2',
    borderRadius: 6,
    color: '#D32F2F',
    fontSize: 14,
    marginBottom: 16,
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
  emptyState: {
    padding: 48,
    textAlign: 'center' as const,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
  },
  tableContainer: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left' as const,
    padding: '10px 12px',
    fontWeight: 600,
    color: '#555',
    borderBottom: '2px solid #e0e0e0',
    whiteSpace: 'nowrap' as const,
    background: '#fafafa',
  },
  tr: {
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '10px 12px',
    color: '#333',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    background: '#f0f0f0',
    color: '#555',
  },
  badgeNew: {
    background: '#E3F2FD',
    color: '#1565C0',
  },
  badgeContacted: {
    background: '#FFF8E1',
    color: '#F57F17',
  },
  badgeQualified: {
    background: '#E8F5E9',
    color: '#2E7D32',
  },
  badgeLost: {
    background: '#FFEBEE',
    color: '#C62828',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: '16px 0',
  },
  pageButton: {
    padding: '6px 14px',
    fontSize: 13,
    border: '1px solid #ccc',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    color: '#333',
  },
  pageInfo: {
    fontSize: 13,
    color: '#666',
  },
  leadLink: {
    color: '#0052CC',
    textDecoration: 'none',
    fontWeight: 500,
  },
}
