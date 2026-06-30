const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS impersonation_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_internal_user_id UUID NOT NULL REFERENCES internal_users(id),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        impersonated_user_id UUID,
        reason TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ended_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','ended','expired')) DEFAULT 'active',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_impersonation_sessions_active_actor
        ON impersonation_sessions(actor_internal_user_id)
        WHERE status = 'active'
    `)

    console.log('Migration 002: created impersonation_sessions table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_impersonation_sessions_active_actor`)
    await sequelize.query(`DROP TABLE IF EXISTS impersonation_sessions`)
    console.log('Migration 002: dropped impersonation_sessions table')
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
  console.log('Usage: node 002-impersonation-sessions.js <up|down>')
}

module.exports = { up, down }
