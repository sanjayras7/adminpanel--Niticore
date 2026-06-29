const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS internal_audit_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_internal_user_id UUID NOT NULL,
        actor_role VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        target_type VARCHAR(255) NOT NULL,
        target_id VARCHAR(255) NOT NULL,
        organization_id UUID,
        lead_id UUID,
        before_values JSONB,
        after_values JSONB,
        reason TEXT,
        metadata JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_internal_audit_events_actor
        ON internal_audit_events(actor_internal_user_id)
    `)
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_internal_audit_events_target
        ON internal_audit_events(target_type, target_id)
    `)
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_internal_audit_events_action
        ON internal_audit_events(action)
    `)
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_internal_audit_events_organization
        ON internal_audit_events(organization_id)
    `)
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_internal_audit_events_created_at
        ON internal_audit_events(created_at DESC)
    `)

    console.log('Migration 003: created internal_audit_events table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      DROP INDEX IF EXISTS idx_internal_audit_events_actor
    `)
    await sequelize.query(`
      DROP INDEX IF EXISTS idx_internal_audit_events_target
    `)
    await sequelize.query(`
      DROP INDEX IF EXISTS idx_internal_audit_events_action
    `)
    await sequelize.query(`
      DROP INDEX IF EXISTS idx_internal_audit_events_organization
    `)
    await sequelize.query(`
      DROP INDEX IF EXISTS idx_internal_audit_events_created_at
    `)
    await sequelize.query(`
      DROP TABLE IF EXISTS internal_audit_events
    `)
    console.log('Migration 003: dropped internal_audit_events table')
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
  console.log('Usage: node 003-create-internal-audit-events.js <up|down>')
}

module.exports = { up, down }
