const { Sequelize } = require('sequelize')

async function up() {
  const sequelize = new Sequelize(process.env.DATABASE_URL, { dialect: 'postgres' })
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS control_framework_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        control_id UUID NOT NULL,
        framework_clause_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(control_id, framework_clause_id)
      )
    `)
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS control_risk_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        control_id UUID NOT NULL,
        risk_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(control_id, risk_id)
      )
    `)
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const sequelize = new Sequelize(process.env.DATABASE_URL, { dialect: 'postgres' })
  try {
    await sequelize.query('DROP TABLE IF EXISTS control_framework_mappings')
    await sequelize.query('DROP TABLE IF EXISTS control_risk_mappings')
  } finally {
    await sequelize.close()
  }
}

module.exports = { up, down }
