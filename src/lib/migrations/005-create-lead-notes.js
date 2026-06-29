const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS lead_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        note_text TEXT NOT NULL,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id)
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_lead_notes_created_by ON lead_notes(created_by)
    `)

    console.log('Migration 005: created lead_notes table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query('DROP TABLE IF EXISTS lead_notes CASCADE')
    console.log('Migration 005: dropped lead_notes table')
  } finally {
    await sequelize.close()
  }
}

module.exports = { up, down }
