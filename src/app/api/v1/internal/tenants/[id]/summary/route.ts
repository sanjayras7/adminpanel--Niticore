import { NextRequest, NextResponse } from 'next/server'
import { Organization, OrganizationModuleConfig, Module, LegalDocument } from '@/lib/models'
import { getAuthUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    await getAuthUser(request)
  } catch {
    return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 })
  }

  const { id } = params

  try {
    const org = await Organization.findByPk(id)
    if (!org) {
      return NextResponse.json({ error: 'not_found', message: 'Tenant not found' }, { status: 404 })
    }

    const moduleConfigs = await OrganizationModuleConfig.findAll({
      where: { organization_id: id, is_enabled: true },
      include: [{ model: Module, as: 'module' }],
    })

    const enabledModules = moduleConfigs
      .map((mc) => {
        const mod = mc.get('module') as Module | null
        return mod?.key ?? null
      })
      .filter((k): k is string => k !== null)

    const legalDocs = await LegalDocument.findAll({
      where: { organization_id: id, deleted_at: null },
      order: [['created_at', 'DESC']],
    })

    let nda = null
    let contract = null
    for (const doc of legalDocs) {
      if (doc.document_type === 'nda' && !nda) {
        nda = doc
      }
      if (doc.document_type === 'contract' && !contract) {
        contract = doc
      }
    }

    function formatLegalDoc(doc: LegalDocument | null) {
      if (!doc) return null
      return {
        id: doc.id,
        documentType: doc.document_type,
        providerStatus: doc.provider_status,
        platformStatus: doc.platform_status,
        signedAt: doc.signed_at?.toISOString() ?? null,
        expiredAt: doc.expired_at?.toISOString() ?? null,
        storageKey: doc.storage_key,
      }
    }

    let tier = 'unconfigured'
    const planConfig = moduleConfigs[0]
    if (planConfig?.config_json?.tier) {
      tier = planConfig.config_json.tier as string
    }

    const planModule = moduleConfigs.find((mc) => {
      const mod = mc.get('module') as Module | null
      return mod?.key === 'plan_tier'
    })
    if (planModule?.config_json?.tier) {
      tier = planModule.config_json.tier as string
    }

    const billingCycle = planModule?.config_json?.billing_cycle as 'monthly' | 'annual' | null ?? null
    const contractValue = planModule?.config_json?.contract_value as number | null ?? null

    return NextResponse.json({
      profile: {
        id: org.id,
        name: org.name,
        domain: org.domain,
        tenantHash: org.tenant_hash,
        createdAt: org.created_at.toISOString(),
      },
      lifecycle: {
        status: org.status,
        onboardingStage: null,
        lastStageCompletedAt: null,
      },
      plan: {
        tier,
        billingCycle,
        enabledModules,
        contractValue,
      },
      legal: {
        nda: formatLegalDoc(nda),
        contract: formatLegalDoc(contract),
      },
    })
  } catch (err) {
    console.error('[TENANT SUMMARY] Error:', err)
    return NextResponse.json({ error: 'internal_error', message: 'Failed to load tenant summary' }, { status: 500 })
  }
}
