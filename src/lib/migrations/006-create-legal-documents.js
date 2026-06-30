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
        lead_id UUID,
        organization_id UUID,
        provider_name VARCHAR(50),
        provider_envelope_id VARCHAR(255),
        provider_status VARCHAR(50),
        platform_status VARCHAR(50),
        signer_names_json TEXT,
        signer_emails_json TEXT,
        sent_at TIMESTAMPTZ,
        viewed_at TIMESTAMPTZ,
        signed_at TIMESTAMPTZ,
        declined_at TIMESTAMPTZ,
        expired_at TIMESTAMPTZ,
        voided_at TIMESTAMPTZ,
        storage_key VARCHAR(255),
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size_bytes BIGINT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_legal_documents_lead_id ON legal_documents(lead_id);
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_legal_documents_organization_id ON legal_documents(organization_id);
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_legal_documents_lead_type ON legal_documents(lead_id, document_type);
    `)

    console.log('Migration 006: created legal_documents table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP TABLE IF EXISTS legal_documents CASCADE`)
    console.log('Migration 006: dropped legal_documents table')
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
  console.log('Usage: node 006-create-legal-documents.js <up|down>')
}

module.exports = { up, down }
