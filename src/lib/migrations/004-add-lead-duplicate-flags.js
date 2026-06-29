const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })
const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })
  try {
    await sequelize.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS potential_duplicate_ids JSONB;`)
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_leads_potential_duplicate_ids ON leads USING GIN (potential_duplicate_ids);`)
    console.log('Migration 004: added potential_duplicate_ids column to leads')
  } finally { await sequelize.close() }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })
  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_leads_potential_duplicate_ids;`)
    await sequelize.query(`ALTER TABLE leads DROP COLUMN IF EXISTS potential_duplicate_ids;`)
    console.log('Migration 004: reverted potential_duplicate_ids column')
  } finally { await sequelize.close() }
}

module.exports = { up, down }
