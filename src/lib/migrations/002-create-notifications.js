const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id UUID NOT NULL REFERENCES internal_users(id),
        organization_id UUID,
        lead_id UUID,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        channel VARCHAR(20) NOT NULL,
        read_at TIMESTAMPTZ,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
        ON notifications(recipient_id, created_at DESC);
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_organization
        ON notifications(organization_id);
    `)

    console.log('Migration 002: created notifications table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_notifications_organization`)
    await sequelize.query(`DROP INDEX IF EXISTS idx_notifications_recipient_created`)
    await sequelize.query(`DROP TABLE IF EXISTS notifications`)
    console.log('Migration 002: rolled back notifications table')
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
  console.log('Usage: node 002-create-notifications.js <up|down>')
}

module.exports = { up, down }
