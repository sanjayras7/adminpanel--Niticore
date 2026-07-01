const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    // 1. organizations (without status, as it gets added by migration 002)
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        tenant_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      );
    `)

    // 1.5. leads and lead_notes
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(255) NOT NULL,
        contact_first_name VARCHAR(255) NOT NULL,
        contact_last_name VARCHAR(255) NOT NULL,
        work_email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        company_domain VARCHAR(255),
        company_website VARCHAR(255),
        country VARCHAR(100),
        region VARCHAR(100),
        company_size VARCHAR(50),
        interested_modules_json JSONB,
        interested_frameworks_json JSONB,
        message TEXT,
        source VARCHAR(50) NOT NULL DEFAULT 'Website Form',
        status VARCHAR(50) NOT NULL DEFAULT 'New',
        assigned_owner_id UUID,
        nda_required BOOLEAN NOT NULL DEFAULT FALSE,
        demo_status VARCHAR(50),
        contract_status VARCHAR(50),
        converted_organization_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `)

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS lead_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id),
        note_text TEXT NOT NULL,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
    `)

    // 2. framework_classifications
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS framework_classifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 3. frameworks
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS frameworks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        classification_id UUID REFERENCES framework_classifications(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 4. framework_versions
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS framework_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        framework_id UUID NOT NULL REFERENCES frameworks(id),
        version_label VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        effective_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(framework_id, version_label)
      );
    `)

    // 5. framework_sections
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS framework_sections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        framework_version_id UUID NOT NULL REFERENCES framework_versions(id),
        parent_section_id UUID REFERENCES framework_sections(id),
        section_code VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 6. framework_clauses
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS framework_clauses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        framework_section_id UUID NOT NULL REFERENCES framework_sections(id),
        clause_code VARCHAR(100) NOT NULL,
        clause_text TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 7. controls
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS controls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        control_code VARCHAR(100) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 8. control_versions
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS control_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        control_id UUID NOT NULL REFERENCES controls(id),
        version_label VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        effective_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 9. control_step_categories
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS control_step_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 10. control_implementation_steps
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS control_implementation_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        control_version_id UUID NOT NULL REFERENCES control_versions(id),
        category_id UUID REFERENCES control_step_categories(id),
        step_code VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 11. control_evidence_types
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS control_evidence_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        control_version_id UUID NOT NULL REFERENCES control_versions(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 12. modules
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        key VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 13. organization_module_config
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS organization_module_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        module_id UUID NOT NULL REFERENCES modules(id),
        enabled BOOLEAN NOT NULL DEFAULT true,
        config_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(organization_id, module_id)
      );
    `)

    // 14. tenant_provisioning_log
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS tenant_provisioning_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        tenant_hash VARCHAR(255) NOT NULL,
        template_version_id UUID REFERENCES framework_versions(id),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    // 15. tenant_provisioning_details
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS tenant_provisioning_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provisioning_log_id UUID NOT NULL REFERENCES tenant_provisioning_log(id),
        schema_name VARCHAR(255) NOT NULL,
        table_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        rows_created INTEGER,
        error_message TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    console.log('Migration 000-core: created organizations, frameworks, controls and provisioning tables')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query('DROP TABLE IF EXISTS lead_notes CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS leads CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS tenant_provisioning_details CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS tenant_provisioning_log CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS organization_module_config CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS modules CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS control_evidence_types CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS control_implementation_steps CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS control_step_categories CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS control_versions CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS controls CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS framework_clauses CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS framework_sections CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS framework_versions CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS frameworks CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS framework_classifications CASCADE')
    await sequelize.query('DROP TABLE IF EXISTS organizations CASCADE')
    console.log('Migration 000-core: dropped core tables')
  } finally {
    await sequelize.close()
  }
}

module.exports = { up, down }
