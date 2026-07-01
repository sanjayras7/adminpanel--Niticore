import { v4 as uuidv4 } from 'uuid'
import { sequelize } from '@/lib/sequelize'
import { initModels } from '@/lib/models'
import {
  InternalRole,
  InternalUser,
  Framework,
  FrameworkVersion,
  FrameworkSection,
  FrameworkClause,
  Organization,
  Lead,
  Control,
  ControlVersion,
  ControlFrameworkMapping,
} from '@/lib/models'

initModels()

const ROLES = [
  { name: 'Super Admin', description: 'Full access to everything, including TOTP resets and gate overrides' },
  { name: 'Implementation Manager', description: 'Create/configure tenants, manage onboarding, send NDA/contracts, invite admins, set modules, set plan/status within allowed rules' },
  { name: 'Customer Success', description: 'View tenants/leads, manage onboarding checklist, add internal notes, resend invites where allowed' },
  { name: 'Support', description: 'Troubleshoot, resend invites, unlock users, view logs, read-only impersonation' },
  { name: 'Finance/Admin', description: 'View plan, billing, contract, commercial fields only' },
  { name: 'Engineering', description: 'View diagnostics, integration health, provisioning logs, usage/errors, technical metadata' },
  { name: 'Read-only Auditor', description: 'View everything, change nothing, no impersonation' },
]

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function seedRoles(): Promise<Map<string, string>> {
  const roleMap = new Map<string, string>()

  for (const role of ROLES) {
    const [record] = await InternalRole.findOrCreate({
      where: { name: role.name },
      defaults: { id: uuidv4(), name: role.name, description: role.description, is_active: true },
    })
    roleMap.set(role.name, record.id)
    console.log(`  Role: ${role.name}`)
  }

  return roleMap
}

async function seedUsers(roleMap: Map<string, string>): Promise<void> {
  for (const role of ROLES) {
    const slug = slugify(role.name)
    const email = `${slug}@niticore-test.internal`
    const spaceIdx = role.name.indexOf(' ')
    const name = spaceIdx > 0 ? role.name.slice(0, spaceIdx) : role.name
    const surname = spaceIdx > 0 ? role.name.slice(spaceIdx + 1) : ''

    const [, created] = await InternalUser.findOrCreate({
      where: { email },
      defaults: {
        id: uuidv4(),
        name,
        surname,
        email,
        internal_role_id: roleMap.get(role.name)!,
        status: 'active',
        totp_enabled: false,
        failed_totp_attempt_count: 0,
      },
    })
    console.log(`  User: ${email} (${created ? 'created' : 'exists'})`)
  }
}

async function seedOrganizations(): Promise<Map<string, string>> {
  const orgMap = new Map<string, string>()

  const [pilotTenant] = await Organization.findOrCreate({
    where: { name: 'Pilot Tenant' },
    defaults: {
      id: uuidv4(),
      name: 'Pilot Tenant',
      domain: 'pilot-tenant.niticore.com',
      tenant_hash: uuidv4().replace(/-/g, '').slice(0, 16),
      status: 'active',
    },
  })
  orgMap.set('Pilot Tenant', pilotTenant.id)
  console.log(`  Organization: Pilot Tenant (${pilotTenant.get('created_at')?.getTime() === pilotTenant.get('updated_at')?.getTime() ? 'created' : 'exists'})`)

  const [draftTenant] = await Organization.findOrCreate({
    where: { name: 'Draft Tenant' },
    defaults: {
      id: uuidv4(),
      name: 'Draft Tenant',
      domain: 'draft-tenant.niticore.com',
      tenant_hash: uuidv4().replace(/-/g, '').slice(0, 16),
      status: 'lead',
    },
  })
  orgMap.set('Draft Tenant', draftTenant.id)
  console.log(`  Organization: Draft Tenant (${draftTenant.get('created_at')?.getTime() === draftTenant.get('updated_at')?.getTime() ? 'created' : 'exists'})`)

  return orgMap
}

async function seedLeads(): Promise<void> {
  const leads = [
    {
      company_name: 'Acme Corp',
      contact_first_name: 'John',
      contact_last_name: 'Smith',
      work_email: 'john.smith@acmecorp.com',
      phone: '+1-555-0101',
      company_domain: 'acmecorp.com',
      company_website: 'https://acmecorp.com',
      country: 'United States',
      region: 'North America',
      company_size: '500',
      source: 'Website Form',
      status: 'New',
    },
    {
      company_name: 'Beta Ltd',
      contact_first_name: 'Sarah',
      contact_last_name: 'Johnson',
      work_email: 'sarah.johnson@betalimited.com',
      phone: '+44-20-7946-0958',
      company_domain: 'betalimited.com',
      company_website: 'https://betalimited.com',
      country: 'United Kingdom',
      region: 'Europe',
      company_size: '200',
      source: 'Website Form',
      status: 'Qualified',
    },
    {
      company_name: 'Gamma Inc',
      contact_first_name: 'Miguel',
      contact_last_name: 'Garcia',
      work_email: 'miguel.garcia@gammainc.io',
      phone: '+49-30-901820',
      company_domain: 'gammainc.io',
      company_website: 'https://gammainc.io',
      country: 'Germany',
      region: 'Europe',
      company_size: '1200',
      source: 'Website Form',
      status: 'NDA Signed',
    },
    {
      company_name: 'Delta Co',
      contact_first_name: 'Aisha',
      contact_last_name: 'Patel',
      work_email: 'aisha.patel@deltaco.au',
      phone: '+61-2-5556-7890',
      company_domain: 'deltaco.au',
      company_website: 'https://deltaco.au',
      country: 'Australia',
      region: 'APAC',
      company_size: '750',
      source: 'Website Form',
      status: 'Demo Scheduled',
    },
    {
      company_name: 'Echo LLC',
      contact_first_name: 'Kenji',
      contact_last_name: 'Tanaka',
      work_email: 'kenji.tanaka@echollc.jp',
      phone: '+81-3-5555-1234',
      company_domain: 'echollc.jp',
      company_website: 'https://echollc.jp',
      country: 'Japan',
      region: 'APAC',
      company_size: '300',
      source: 'Website Form',
      status: 'Ready for Onboarding',
    },
  ]

  for (const lead of leads) {
    const [, created] = await Lead.findOrCreate({
      where: { company_name: lead.company_name },
      defaults: { id: uuidv4(), ...lead },
    })
    console.log(`  Lead: ${lead.company_name} (${created ? 'created' : 'exists'})`)
  }
}

async function seedFrameworks(): Promise<void> {
  const frameworksData = [
    {
      name: 'SOC 2',
      description: 'Service Organization Control 2 — trust services criteria for security, availability, processing integrity, confidentiality, and privacy',
      classification: 'Compliance',
      version: '1.0',
      sections: [
        { code: 'CC1', title: 'Control Environment', description: 'Commitment to integrity and ethical values' },
        { code: 'CC2', title: 'Communication and Information', description: 'Communication of information to support internal control' },
        { code: 'CC3', title: 'Risk Assessment', description: 'Risk identification and analysis for achieving objectives' },
      ],
    },
    {
      name: 'ISO 27001',
      description: 'Information security management system (ISMS) requirements',
      classification: 'Security',
      version: '2022',
      sections: [
        { code: 'A.5', title: 'Information Security Policies', description: 'Policies for information security management' },
        { code: 'A.6', title: 'Organization of Information Security', description: 'Roles and responsibilities for information security' },
        { code: 'A.7', title: 'Human Resource Security', description: 'Security controls for personnel throughout employment' },
      ],
    },
  ]

  for (const fw of frameworksData) {
    let classificationId: string | null = null

    const [classResults] = await sequelize.query(
      'SELECT id FROM framework_classifications WHERE name = :name LIMIT 1',
      { replacements: { name: fw.classification } },
    )

    if (Array.isArray(classResults) && classResults.length > 0) {
      classificationId = (classResults[0] as { id: string }).id
    } else {
      classificationId = uuidv4()
      await sequelize.query(
        `INSERT INTO framework_classifications (id, name, created_at, updated_at) VALUES (:id, :name, NOW(), NOW())`,
        { replacements: { id: classificationId, name: fw.classification } },
      )
    }

    const [existingFramework] = await Framework.findOrCreate({
      where: { name: fw.name },
      defaults: {
        id: uuidv4(),
        name: fw.name,
        description: fw.description,
        classification_id: classificationId,
      },
    })

    console.log(`  Framework: ${fw.name}`)

    const [existingVersion] = await FrameworkVersion.findOrCreate({
      where: { framework_id: existingFramework.id, version_label: fw.version },
      defaults: {
        id: uuidv4(),
        framework_id: existingFramework.id,
        version_label: fw.version,
        description: fw.description,
        status: 'active',
        effective_date: new Date(),
      },
    })

    for (const [idx, section] of fw.sections.entries()) {
      const [fwSection] = await FrameworkSection.findOrCreate({
        where: { framework_version_id: existingVersion.id, section_code: section.code },
        defaults: {
          id: uuidv4(),
          framework_version_id: existingVersion.id,
          section_code: section.code,
          title: section.title,
          description: section.description,
          sort_order: idx + 1,
        },
      })

      const clauseCode = `${section.code}.1`
      const [fwClause] = await FrameworkClause.findOrCreate({
        where: { framework_section_id: fwSection.id, clause_code: clauseCode },
        defaults: {
          id: uuidv4(),
          framework_section_id: fwSection.id,
          clause_code: clauseCode,
          clause_text: `Requirements for ${section.title.toLowerCase()} — refer to framework documentation for full control details.`,
          sort_order: 1,
        },
      })

      const [control] = await Control.findOrCreate({
        where: { control_code: `${fw.name === 'SOC 2' ? 'SOC' : 'ISO'}-${section.code}` },
        defaults: {
          id: uuidv4(),
          control_code: `${fw.name === 'SOC 2' ? 'SOC' : 'ISO'}-${section.code}`,
          title: section.title,
          description: section.description,
        },
      })

      const [controlVersion] = await ControlVersion.findOrCreate({
        where: { control_id: control.id, version_label: '1.0' },
        defaults: {
          id: uuidv4(),
          control_id: control.id,
          version_label: '1.0',
          description: section.description,
          status: 'active',
        },
      })

      await ControlFrameworkMapping.findOrCreate({
        where: { control_id: control.id, framework_clause_id: fwClause.id },
        defaults: {
          id: uuidv4(),
          control_id: control.id,
          framework_clause_id: fwClause.id,
        },
      })
    }

    console.log(`  Controls for ${fw.name}: ${fw.sections.length}`)
  }
}

async function main(): Promise<void> {
  console.log('\nStarting dev seed...\n')

  console.log('Seeding internal roles...')
  const roleMap = await seedRoles()

  console.log('\nSeeding internal users...')
  await seedUsers(roleMap)

  console.log('\nSeeding organizations...')
  await seedOrganizations()

  console.log('\nSeeding leads...')
  await seedLeads()

  console.log('\nSeeding frameworks with controls...')
  await seedFrameworks()

  console.log('\nDev seed completed successfully.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
