const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wizard_state (
        id UUID PRIMARY KEY,
        lead_id UUID NOT NULL REFERENCES leads(id),
        organization_id UUID REFERENCES organizations(id),
        step_data JSONB NOT NULL DEFAULT '{}',
        current_step VARCHAR(50) NOT NULL DEFAULT 'organization',
        completed_steps JSONB NOT NULL DEFAULT '[]',
        created_by UUID REFERENCES internal_users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_wizard_state_lead_id
        ON wizard_state(lead_id);
    `)

    console.log('Migration 002: created wizard_state table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_wizard_state_lead_id`)
    await sequelize.query(`DROP TABLE IF EXISTS wizard_state`)
    console.log('Migration 002: dropped wizard_state table')
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
  console.log('Usage: node 002-create-wizard-state.js <up|down>')
}

module.exports = { up, down }
