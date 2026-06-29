const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS gate_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gate_type VARCHAR(20) NOT NULL CHECK (gate_type IN ('nda', 'contract')),
        lead_id UUID REFERENCES leads(id),
        organization_id UUID REFERENCES organizations(id),
        overridden_by UUID NOT NULL REFERENCES internal_users(id),
        reason TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_gate_overrides_lead_id ON gate_overrides(lead_id);
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_gate_overrides_organization_id ON gate_overrides(organization_id);
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_gate_overrides_created_at ON gate_overrides(created_at);
    `)

    console.log('Migration 002: created gate_overrides table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_gate_overrides_created_at`)
    await sequelize.query(`DROP INDEX IF EXISTS idx_gate_overrides_organization_id`)
    await sequelize.query(`DROP INDEX IF EXISTS idx_gate_overrides_lead_id`)
    await sequelize.query(`DROP TABLE IF EXISTS gate_overrides`)
    console.log('Migration 002: dropped gate_overrides table')
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
  console.log('Usage: node 002-create-gate-overrides.js <up|down>')
}

module.exports = { up, down }
