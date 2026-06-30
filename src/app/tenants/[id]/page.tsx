import TenantSummary from '@/app/components/TenantSummary'

export default function TenantDetailPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#111827', marginBottom: '24px' }}>
        Tenant Detail
      </h1>
      <TenantSummary tenantId={params.id} />
    </div>
  )
}
