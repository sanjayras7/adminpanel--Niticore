const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS organization_framework_selections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        framework_id UUID REFERENCES frameworks(id),
        framework_version_id UUID REFERENCES framework_versions(id),
        framework_name VARCHAR(255),
        framework_version_name VARCHAR(100),
        selected_control_ids JSONB,
        risk_threshold VARCHAR(50) NOT NULL DEFAULT 'medium',
        is_stub_data BOOLEAN NOT NULL DEFAULT false,
        created_by UUID REFERENCES internal_users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS organization_integration_intents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        domain VARCHAR(255),
        sso_required BOOLEAN NOT NULL DEFAULT false,
        sso_provider VARCHAR(100),
        notes TEXT,
        created_by UUID REFERENCES internal_users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_org_framework_selections_org
        ON organization_framework_selections(organization_id);
    `)

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_org_integration_intents_org
        ON organization_integration_intents(organization_id);
    `)

    console.log('Migration 002: created framework selections and integration intents tables')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query('DROP INDEX IF EXISTS idx_org_integration_intents_org')
    await sequelize.query('DROP INDEX IF EXISTS idx_org_framework_selections_org')
    await sequelize.query('DROP TABLE IF EXISTS organization_integration_intents')
    await sequelize.query('DROP TABLE IF EXISTS organization_framework_selections')
    console.log('Migration 002: rolled back framework and integration tables')
  } finally {
    await sequelize.close()
  }
}

module.exports = { up, down }
