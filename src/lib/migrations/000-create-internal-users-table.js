const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS internal_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        surname VARCHAR(255) NOT NULL,
        email VARCHAR(320) NOT NULL,
        internal_role_id UUID,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        totp_enabled BOOLEAN NOT NULL DEFAULT false,
        totp_secret_encrypted TEXT,
        totp_enrolled_at TIMESTAMPTZ,
        totp_reset_at TIMESTAMPTZ,
        totp_reset_by UUID,
        totp_reset_reason TEXT,
        last_login_at TIMESTAMPTZ,
        last_totp_verified_at TIMESTAMPTZ,
        failed_totp_attempt_count INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      )
    `)

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_internal_users_email
        ON internal_users(email)
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_internal_users_deleted_at
        ON internal_users(deleted_at)
    `)

    console.log('Migration 000: created internal_users table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_internal_users_deleted_at`)
    await sequelize.query(`DROP INDEX IF EXISTS idx_internal_users_email`)
    await sequelize.query(`DROP TABLE IF EXISTS internal_users`)
    console.log('Migration 000: dropped internal_users table')
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
  console.log('Usage: node 000-create-internal-users-table.js <up|down>')
}

module.exports = { up, down }
