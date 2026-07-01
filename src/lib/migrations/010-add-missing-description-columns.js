const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    // ── framework_versions ────────────────────────────────────────────────────
    // Model declares description TEXT but original migration omitted it
    await sequelize.query(`
      ALTER TABLE framework_versions
        ADD COLUMN IF NOT EXISTS description TEXT;
    `)

    // ── control_versions ──────────────────────────────────────────────────────
    // Same: model declares description TEXT but original migration omitted it
    await sequelize.query(`
      ALTER TABLE control_versions
        ADD COLUMN IF NOT EXISTS description TEXT;
    `)

    // ── tenant_provisioning_log ───────────────────────────────────────────────
    // Model declares failed_table and error_message but migration omitted them
    await sequelize.query(`
      ALTER TABLE tenant_provisioning_log
        ADD COLUMN IF NOT EXISTS failed_table VARCHAR(255),
        ADD COLUMN IF NOT EXISTS error_message TEXT;
    `)

    console.log('Migration 010: added missing columns to framework_versions, control_versions, tenant_provisioning_log')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`ALTER TABLE framework_versions DROP COLUMN IF EXISTS description;`)
    await sequelize.query(`ALTER TABLE control_versions DROP COLUMN IF EXISTS description;`)
    await sequelize.query(`
      ALTER TABLE tenant_provisioning_log
        DROP COLUMN IF EXISTS failed_table,
        DROP COLUMN IF EXISTS error_message;
    `)
    console.log('Migration 010: removed added columns')
  } finally {
    await sequelize.close()
  }
}

module.exports = { up, down }
