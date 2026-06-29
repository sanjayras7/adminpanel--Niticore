'use client'

import { useEffect, useState, useCallback } from 'react'

interface LegalDocStatus {
  id: string
  documentType: 'nda' | 'contract'
  providerStatus: 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired' | 'voided'
  platformStatus: 'pending' | 'completed' | 'failed'
  signedAt: string | null
  expiredAt: string | null
  storageKey: string | null
}

interface TenantSummaryResponse {
  profile: {
    id: string
    name: string
    domain: string | null
    tenantHash: string
    createdAt: string
  }
  lifecycle: {
    status: 'lead' | 'onboarding' | 'active' | 'suspended' | 'churned'
    onboardingStage: string | null
    lastStageCompletedAt: string | null
  }
  plan: {
    tier: string
    billingCycle: 'monthly' | 'annual' | null
    enabledModules: string[]
    contractValue: number | null
  }
  legal: {
    nda: LegalDocStatus | null
    contract: LegalDocStatus | null
  }
}

interface TenantSummaryProps {
  tenantId: string
  initialData?: TenantSummaryResponse
}

const statusColors: Record<string, string> = {
  lead: '#6b7280',
  onboarding: '#f59e0b',
  active: '#10b981',
  suspended: '#ef4444',
  churned: '#6b7280',
}

const legalStatusColors: Record<string, string> = {
  draft: '#6b7280',
  sent: '#3b82f6',
  viewed: '#8b5cf6',
  signed: '#10b981',
  declined: '#ef4444',
  expired: '#f59e0b',
  voided: '#6b7280',
  pending: '#f59e0b',
  completed: '#10b981',
  failed: '#ef4444',
}

function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ padding: '16px' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '14px',
            background: '#e5e7eb',
            borderRadius: '4px',
            marginBottom: i < lines - 1 ? '12px' : '0',
            width: `${60 + Math.random() * 30}%`,
          }}
        />
      ))}
    </div>
  )
}

function Badge({
  label,
  color,
}: {
  label: string
  color: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        color: color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          fontSize: '14px',
          fontWeight: 600,
          color: '#374151',
        }}
      >
        {title}
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '6px 0',
        fontSize: '13px',
      }}
    >
      <span style={{ color: '#6b7280', minWidth: '120px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function LegalDocCard({
  title,
  doc,
}: {
  title: string
  doc: LegalDocStatus | null
}) {
  if (!doc) {
    return (
      <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
        No {title} sent
      </div>
    )
  }

  return (
    <div style={{ fontSize: '13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Badge label={doc.providerStatus} color={legalStatusColors[doc.providerStatus] || '#6b7280'} />
        {doc.signedAt && (
          <span style={{ color: '#6b7280', fontSize: '12px' }}>
            Signed {new Date(doc.signedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {doc.expiredAt && (
        <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
          Expired {new Date(doc.expiredAt).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}

export default function TenantSummary({ tenantId, initialData }: TenantSummaryProps) {
  const [data, setData] = useState<TenantSummaryResponse | null>(initialData ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initialData)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/internal/tenants/${tenantId}/summary`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Tenant not found')
          return
        }
        throw new Error(`Request failed with status ${res.status}`)
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant summary')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (!initialData) {
      fetchData()
    }
  }, [fetchData, initialData])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SectionCard title="Profile"><SkeletonBlock lines={4} /></SectionCard>
        <SectionCard title="Lifecycle"><SkeletonBlock lines={2} /></SectionCard>
        <SectionCard title="Plan / Commercial"><SkeletonBlock lines={3} /></SectionCard>
        <SectionCard title="NDA / Contract"><SkeletonBlock lines={2} /></SectionCard>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '24px',
          background: '#fef2f2',
          textAlign: 'center',
        }}
      >
        <div style={{ color: '#dc2626', fontSize: '15px', fontWeight: 500, marginBottom: '12px' }}>
          {error}
        </div>
        <button
          onClick={fetchData}
          style={{
            padding: '8px 20px',
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionCard title="Profile">
        <FieldRow label="Company name" value={data.profile.name} />
        <FieldRow label="Domain" value={data.profile.domain} />
        <FieldRow label="Tenant hash" value={data.profile.tenantHash} />
        <FieldRow label="Created" value={formatDate(data.profile.createdAt)} />
      </SectionCard>

      <SectionCard title="Lifecycle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ color: '#6b7280', fontSize: '13px' }}>Status</span>
          <Badge label={data.lifecycle.status} color={statusColors[data.lifecycle.status] || '#6b7280'} />
        </div>
        <FieldRow label="Onboarding stage" value={data.lifecycle.onboardingStage} />
        <FieldRow label="Last stage completed" value={data.lifecycle.lastStageCompletedAt ? formatDate(data.lifecycle.lastStageCompletedAt) : null} />
      </SectionCard>

      <SectionCard title="Plan / Commercial">
        <FieldRow label="Plan tier" value={data.plan.tier} />
        <FieldRow label="Billing cycle" value={data.plan.billingCycle} />
        <FieldRow label="Contract value" value={data.plan.contractValue != null ? `$${data.plan.contractValue.toLocaleString()}` : null} />
        {data.plan.enabledModules.length > 0 && (
          <div style={{ padding: '6px 0' }}>
            <div style={{ color: '#6b7280', fontSize: '13px', marginBottom: '6px' }}>Enabled modules</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {data.plan.enabledModules.map((mod) => (
                <span
                  key={mod}
                  style={{
                    padding: '2px 8px',
                    background: '#f3f4f6',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#374151',
                  }}
                >
                  {mod}
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="NDA / Contract">
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>NDA</div>
          <LegalDocCard title="NDA" doc={data.legal.nda} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>Contract</div>
          <LegalDocCard title="Contract" doc={data.legal.contract} />
        </div>
      </SectionCard>
    </div>
  )
}
