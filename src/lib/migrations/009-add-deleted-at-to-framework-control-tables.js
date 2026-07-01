const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    // frameworks — Sequelize model has paranoid: true but migration omitted deleted_at
    await sequelize.query(`
      ALTER TABLE frameworks
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    `)

    // framework_versions — same issue
    await sequelize.query(`
      ALTER TABLE framework_versions
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    `)

    // controls — same issue
    await sequelize.query(`
      ALTER TABLE controls
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    `)

    // control_versions — same issue
    await sequelize.query(`
      ALTER TABLE control_versions
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    `)

    console.log('Migration 009: added deleted_at to frameworks, framework_versions, controls, control_versions')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`ALTER TABLE frameworks DROP COLUMN IF EXISTS deleted_at;`)
    await sequelize.query(`ALTER TABLE framework_versions DROP COLUMN IF EXISTS deleted_at;`)
    await sequelize.query(`ALTER TABLE controls DROP COLUMN IF EXISTS deleted_at;`)
    await sequelize.query(`ALTER TABLE control_versions DROP COLUMN IF EXISTS deleted_at;`)
    console.log('Migration 009: removed deleted_at from frameworks, framework_versions, controls, control_versions')
  } finally {
    await sequelize.close()
  }
}

module.exports = { up, down }
