const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS internal_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        internal_user_id UUID NOT NULL REFERENCES internal_users(id),
        token_hash CHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        idle_expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT NOT NULL
      );
    `)

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_internal_sessions_token_hash
        ON internal_sessions(token_hash);
    `)

    console.log('Migration 002: created internal_sessions table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_internal_sessions_token_hash`)
    await sequelize.query(`DROP TABLE IF EXISTS internal_sessions`)
    console.log('Migration 002: rolled back internal_sessions table')
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
  console.log('Usage: node 002-internal-sessions.js <up|down>')
}

module.exports = { up, down }
