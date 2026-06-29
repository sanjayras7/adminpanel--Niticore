const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(255) NOT NULL,
        contact_first_name VARCHAR(255) NOT NULL,
        contact_last_name VARCHAR(255) NOT NULL,
        work_email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        company_domain VARCHAR(255),
        company_website VARCHAR(255),
        country VARCHAR(100),
        region VARCHAR(100),
        company_size VARCHAR(50),
        interested_modules_json JSONB,
        interested_frameworks_json JSONB,
        message TEXT,
        source VARCHAR(50) NOT NULL DEFAULT 'Website Form',
        status VARCHAR(50) NOT NULL DEFAULT 'New',
        assigned_owner_id UUID,
        nda_required BOOLEAN NOT NULL DEFAULT FALSE,
        demo_status VARCHAR(50),
        contract_status VARCHAR(50),
        converted_organization_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `)

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS lead_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id),
        note_text TEXT NOT NULL,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
    `)

    console.log('Migration 002: created leads and lead_notes tables successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP TABLE IF EXISTS lead_notes CASCADE`)
    await sequelize.query(`DROP TABLE IF EXISTS leads CASCADE`)
    console.log('Migration 002: dropped leads and lead_notes tables')
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
  console.log('Usage: node 002-create-leads.js <up|down>')
}

module.exports = { up, down }
