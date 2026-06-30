const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'Draft'
        CONSTRAINT chk_organization_status CHECK (status IN ('Draft','Pending Setup','Active','Suspended','Churned','Archived'));
    `)

    console.log('Migration 002: added status column to organizations table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      ALTER TABLE organizations
        DROP CONSTRAINT IF EXISTS chk_organization_status,
        DROP COLUMN IF EXISTS status;
    `)
    console.log('Migration 002: rolled back status column on organizations')
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
  console.log('Usage: node 002-add-status-to-organizations.js <up|down>')
}

module.exports = { up, down }
