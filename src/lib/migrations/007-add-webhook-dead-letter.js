const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS webhook_dead_letter (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_envelope_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        raw_payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_legal_documents_org_type_status
        ON legal_documents(organization_id, document_type, platform_status)
        WHERE deleted_at IS NULL;
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_legal_documents_provider_envelope
        ON legal_documents(provider_envelope_id)
        WHERE deleted_at IS NULL;
    `)

    console.log('Migration 007: created webhook_dead_letter table and contract indexes')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP TABLE IF EXISTS webhook_dead_letter`)
    await sequelize.query(`DROP INDEX IF EXISTS idx_legal_documents_org_type_status`)
    await sequelize.query(`DROP INDEX IF EXISTS idx_legal_documents_provider_envelope`)
    console.log('Migration 007: dropped webhook_dead_letter table')
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
  console.log('Usage: node 007-add-webhook-dead-letter.js <up|down>')
}

module.exports = { up, down }
