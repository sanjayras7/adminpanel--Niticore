const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS tenant_framework_config (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES public.organizations(id),
        framework_id UUID NOT NULL REFERENCES public.frameworks(id),
        framework_version_id UUID NOT NULL REFERENCES public.framework_versions(id),
        is_active BOOLEAN NOT NULL DEFAULT true,
        assigned_by UUID NOT NULL REFERENCES internal_users(id),
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deactivated_at TIMESTAMPTZ NULL,
        deactivated_by UUID NULL REFERENCES internal_users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_framework_config_active_unique
        ON tenant_framework_config(organization_id, framework_id, framework_version_id)
        WHERE is_active = true;
    `)

    console.log('Migration 002: created tenant_framework_config table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_tenant_framework_config_active_unique`)
    await sequelize.query(`DROP TABLE IF EXISTS tenant_framework_config`)
    console.log('Migration 002: rolled back tenant_framework_config table')
  } finally {
    await sequelize.close()
  }
}

const command = process.argv[2]
if (command === 'up') {
  up().catch((err) => { console.error(err); process.exit(1) })
} else if (command === 'down') {
  down().catch((err) => { console.error(err); process.exit(1) })
} else {
  console.log('Usage: node 002-tenant-framework-config.js <up|down>')
}

module.exports = { up, down }
