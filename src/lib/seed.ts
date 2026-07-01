// dev seed — fully idempotent. Safe to re-run against an existing database.
import 'dotenv/config'
import type { Model, ModelStatic } from 'sequelize'
import { sequelize } from './sequelize'
import {
  InternalRole, InternalUser, MagicLink, InternalSession, InternalAuditEvent,
  Lead, LeadNote, LegalDocument, GateOverride,
  Module, Organization, OrganizationModuleConfig, OrganizationAdminInvite,
  OrganizationFrameworkSelection, OrganizationIntegrationIntent, WizardState,
  FrameworkClassification, Framework, FrameworkVersion, FrameworkSection, FrameworkClause,
  Control, ControlVersion, ControlStepCategory, ControlImplementationStep, ControlEvidenceType,
  ControlFrameworkMapping, ControlRiskMapping,
  TenantFrameworkConfig, TenantProvisioningLog, TenantProvisioningDetail,
  ImpersonationSession, Notification,
} from './models'

/** findOrCreate wrapper — injects timestamps for models with timestamps:true */
async function upsert<M extends Model>(
  model: ModelStatic<M>,
  where: Record<string, unknown>,
  defaults: Record<string, unknown> = {},
): Promise<[M, boolean]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return model.findOrCreate({ where, defaults: { created_at: new Date(), updated_at: new Date(), ...defaults } } as any)
}

/** findOrCreate wrapper for models with timestamps:false (no updated_at column) */
async function upsertNoTs<M extends Model>(
  model: ModelStatic<M>,
  where: Record<string, unknown>,
  defaults: Record<string, unknown> = {},
): Promise<[M, boolean]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return model.findOrCreate({ where, defaults: { created_at: new Date(), ...defaults } } as any)
}

async function seed() {
  await sequelize.authenticate()

  // ── Internal role ──────────────────────────────────────────────────────────
  const [role] = await upsert(InternalRole, { name: 'Super Admin' }, {
    description: 'Full access', is_active: true,
  })

  // ── Internal user ─────────────────────────────────────────────────────────
  const [user] = await upsert(InternalUser, { email: 'dev@niticore.com' }, {
    name: 'Dev', surname: 'Admin', job_title: 'Admin',
    internal_role_id: role.id, status: 'active', totp_enabled: false,
    failed_totp_attempt_count: 0,
  })

  // ── Magic link ────────────────────────────────────────────────────────────
  await upsert(MagicLink, { token: 'dev-token-0123456789' }, {
    otp: '123456', email: user.email, internal_user_id: user.id,
    purpose: 'login', expires_at: new Date(Date.now() + 30 * 24 * 60 * 60_000), // 30 days for dev
  })

  // ── Internal session ──────────────────────────────────────────────────────
  await upsert(InternalSession, { token_hash: 'a'.repeat(64) }, {
    internal_user_id: user.id,
    expires_at: new Date(Date.now() + 86_400_000),
    idle_expires_at: new Date(Date.now() + 3_600_000),
    last_activity_at: new Date(),
    ip_address: '127.0.0.1',
    user_agent: 'seed-script',
  })

  // ── Organization ──────────────────────────────────────────────────────────
  const [org] = await upsert(Organization, { domain: 'acme.com' }, {
    name: 'Acme Corp', tenant_hash: 'acme-dev-seed', status: 'Active',
  })

  // ── Lead ──────────────────────────────────────────────────────────────────
  const [lead] = await upsert(Lead, { work_email: 'jane@globex.com' }, {
    company_name: 'Globex Inc', contact_first_name: 'Jane', contact_last_name: 'Doe',
    phone: '+1-555-0100', company_domain: 'globex.com',
    company_website: 'https://globex.com', country: 'US', region: 'CA', company_size: '50-200',
    interested_modules_json: ['framework-controls'], interested_frameworks_json: ['ISO 27001'],
    message: 'Interested in compliance tooling.', source: 'Website Form', status: 'New',
    assigned_owner_id: user.id, nda_required: true, demo_status: 'Scheduled', contract_status: 'Pending',
  })

  // ── Lead note ─────────────────────────────────────────────────────────────
  // No unique key — only insert if there are no notes for this lead yet
  const existingNotes = Number(await LeadNote.count({ where: { lead_id: lead.id } } as never))
  if (existingNotes === 0) {
    await LeadNote.create({
      lead_id: lead.id, note_text: 'Initial call went well.',
      created_by: user.id, created_at: new Date(), updated_at: new Date(),
    } as never)
  }

  // ── Legal document ────────────────────────────────────────────────────────
  await upsert(LegalDocument, { provider_envelope_id: 'env-123' }, {
    document_type: 'nda', lead_id: lead.id, organization_id: org.id,
    provider_name: 'DocuSign', provider_status: 'sent', platform_status: 'Sent',
    sent_at: new Date(), created_by: user.id,
  })

  // ── Gate override ─────────────────────────────────────────────────────────
  const existingOverrides = Number(await GateOverride.count({ where: { lead_id: lead.id, gate_type: 'nda' } } as never))
  if (existingOverrides === 0) {
    await GateOverride.create({
      gate_type: 'nda', lead_id: lead.id, overridden_by: user.id,
      reason: 'Pilot customer, NDA waived.', created_at: new Date(),
    } as never)
  }

  // ── Module ────────────────────────────────────────────────────────────────
  const [mod] = await upsert(Module, { key: 'framework-controls' }, {
    name: 'Framework Controls', is_active: true,
  })

  // ── Organization module config ─────────────────────────────────────────────
  await upsert(OrganizationModuleConfig, { organization_id: org.id, module_id: mod.id }, {
    enabled: true,
  })

  // ── Organization admin invite ──────────────────────────────────────────────
  await upsert(OrganizationAdminInvite,
    { organization_id: org.id, internal_user_id: user.id },
    { status: 'pending', invited_by: user.id, expires_at: new Date(Date.now() + 7 * 86_400_000) },
  )

  // ── Organization integration intent ───────────────────────────────────────
  await upsert(OrganizationIntegrationIntent, { organization_id: org.id }, {
    domain: 'acme.com', sso_required: false, created_by: user.id,
  })

  // ── Wizard state ──────────────────────────────────────────────────────────
  await upsert(WizardState, { lead_id: lead.id }, {
    organization_id: org.id, step_data: { companyName: 'Acme Corp' },
    current_step: 'organization', completed_steps: [], created_by: user.id,
  })

  // ── Framework hierarchy ───────────────────────────────────────────────────
  const [classification] = await upsert(FrameworkClassification, { name: 'Security' }, {
    description: 'Security standards',
  })

  const [framework] = await upsert(Framework, { name: 'ISO 27001' }, {
    description: 'Information security management', classification_id: classification.id,
  })

  const [frameworkVersion] = await upsert(
    FrameworkVersion,
    { framework_id: framework.id, version_label: '2022' },
    { status: 'active', effective_date: new Date() },
  )

  const [section] = await upsert(FrameworkSection, {
    framework_version_id: frameworkVersion.id, section_code: 'A.5',
  }, {
    title: 'Organizational controls', sort_order: 1,
  })

  const [clause] = await upsert(FrameworkClause, {
    framework_section_id: section.id, clause_code: 'A.5.1',
  }, {
    clause_text: 'Policies for information security', sort_order: 1,
  })

  // ── Organization framework selection ──────────────────────────────────────
  await upsert(OrganizationFrameworkSelection,
    { organization_id: org.id, framework_id: framework.id, framework_version_id: frameworkVersion.id },
    {
      framework_name: framework.name, framework_version_name: frameworkVersion.version_label,
      selected_control_ids: [], risk_threshold: 'medium', created_by: user.id,
    },
  )

  // ── Controls ──────────────────────────────────────────────────────────────
  const [control] = await upsert(Control, { control_code: 'CTRL-001' }, {
    title: 'Access Control Policy', description: 'Define and enforce access control policy.',
  })

  const [controlVersion] = await upsert(
    ControlVersion,
    { control_id: control.id, version_label: '1.0' },
    { status: 'active', effective_date: new Date() },
  )

  const [stepCategory] = await upsert(ControlStepCategory, { name: 'Policy' }, {
    description: 'Policy-related steps',
  })

  // ControlImplementationStep has no natural unique key — guard by count
  const existingSteps = Number(await ControlImplementationStep.count({
    where: { control_version_id: controlVersion.id, step_code: 'STEP-1' },
  } as never))
  if (existingSteps === 0) {
    await ControlImplementationStep.create({
      control_version_id: controlVersion.id, step_code: 'STEP-1',
      title: 'Draft policy document', category_id: stepCategory.id,
      sort_order: 1, created_at: new Date(), updated_at: new Date(),
    } as never)
  }

  // ControlEvidenceType has no natural unique key — guard by count
  const existingEvidence = Number(await ControlEvidenceType.count({
    where: { control_version_id: controlVersion.id },
  } as never))
  if (existingEvidence === 0) {
    await ControlEvidenceType.create({
      control_version_id: controlVersion.id, name: 'Signed policy PDF',
      created_at: new Date(), updated_at: new Date(),
    } as never)
  }

  // ── Control mappings ──────────────────────────────────────────────────────
  await upsert(ControlFrameworkMapping,
    { control_id: control.id, framework_clause_id: clause.id },
    {},
  )

  await upsert(ControlRiskMapping,
    { control_id: control.id, risk_id: '00000000-0000-0000-0000-000000000001' },
    {},
  )

  // ── Tenant framework config ───────────────────────────────────────────────
  const existingTfc = Number(await TenantFrameworkConfig.count({
    where: { organization_id: org.id, framework_id: framework.id, framework_version_id: frameworkVersion.id },
  } as never))
  if (existingTfc === 0) {
    await TenantFrameworkConfig.create({
      organization_id: org.id, framework_id: framework.id,
      framework_version_id: frameworkVersion.id, is_active: true,
      assigned_by: user.id, assigned_at: new Date(),
      created_at: new Date(), updated_at: new Date(),
    } as never)
  }

  // ── Tenant provisioning log / detail ──────────────────────────────────────
  // These models have timestamps:false — use upsertNoTs to avoid unknown-attribute warning
  const PROV_LOG_ID = '11111111-1111-1111-1111-111111111111'
  await upsertNoTs(TenantProvisioningLog, { id: PROV_LOG_ID }, {
    organization_id: org.id, tenant_hash: org.tenant_hash,
    template_version_id: frameworkVersion.id, status: 'success',
    started_at: new Date(), completed_at: new Date(),
  })

  const PROV_DETAIL_ID = '22222222-2222-2222-2222-222222222222'
  await upsertNoTs(TenantProvisioningDetail, { id: PROV_DETAIL_ID }, {
    provisioning_log_id: PROV_LOG_ID,
    schema_name: 'public', table_name: 'organizations', status: 'created',
    rows_created: 1, started_at: new Date(), completed_at: new Date(),
  })

  // ── Impersonation session ─────────────────────────────────────────────────
  // Unique partial index only allows one active session per actor — guard by count
  const existingImpersonation = Number(await ImpersonationSession.count({
    where: { actor_internal_user_id: user.id, status: 'active' },
  } as never))
  if (existingImpersonation === 0) {
    await ImpersonationSession.create({
      actor_internal_user_id: user.id, organization_id: org.id,
      reason: 'Customer support debugging', expires_at: new Date(Date.now() + 3_600_000),
      created_at: new Date(), updated_at: new Date(),
    } as never)
  }

  // ── Notification ──────────────────────────────────────────────────────────
  const existingNotif = Number(await Notification.count({
    where: { recipient_id: user.id, title: 'Welcome' },
  } as never))
  if (existingNotif === 0) {
    await Notification.create({
      recipient_id: user.id, organization_id: org.id,
      title: 'Welcome', body: 'Org provisioned successfully.',
      channel: 'in_app', created_at: new Date(),
    } as never)
  }

  // ── Audit event ───────────────────────────────────────────────────────────
  const existingAudit = Number(await InternalAuditEvent.count({
    where: { actor_internal_user_id: user.id, action: 'org.create', target_id: org.id },
  } as never))
  if (existingAudit === 0) {
    await InternalAuditEvent.create({
      actor_internal_user_id: user.id, actor_role: role.name, action: 'org.create',
      target_type: 'organization', target_id: org.id, organization_id: org.id,
      after_values: { status: 'active' }, created_at: new Date(),
    } as never)
  }

  console.log('Seeded OK:', { userId: user.id, orgId: org.id, leadId: lead.id })
  await sequelize.close()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
