const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS legal_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_type VARCHAR(50) NOT NULL,
        organization_id UUID NOT NULL,
        lead_id UUID,
        provider_name VARCHAR(100),
        provider_envelope_id VARCHAR(255) NOT NULL,
        provider_status VARCHAR(100),
        platform_status VARCHAR(50),
        signer_names_json TEXT NOT NULL,
        signer_emails_json TEXT NOT NULL,
        sent_at TIMESTAMPTZ,
        viewed_at TIMESTAMPTZ,
        signed_at TIMESTAMPTZ,
        declined_at TIMESTAMPTZ,
        expired_at TIMESTAMPTZ,
        voided_at TIMESTAMPTZ,
        storage_key VARCHAR(500),
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size_bytes INTEGER,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
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

    console.log('Migration 002: created legal_documents and webhook_dead_letter tables')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP TABLE IF EXISTS webhook_dead_letter;`)
    await sequelize.query(`DROP TABLE IF EXISTS legal_documents;`)
    console.log('Migration 002: dropped legal_documents and webhook_dead_letter tables')
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
  console.log('Usage: node 002-legal-documents.js <up|down>')
}

module.exports = { up, down }
