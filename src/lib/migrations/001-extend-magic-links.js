const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      ALTER TABLE magic_links
        ADD COLUMN IF NOT EXISTS internal_user_id UUID REFERENCES internal_users(id),
        ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) CHECK (purpose IN ('login','totp_enrollment'));
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_magic_links_internal_user_purpose
        ON magic_links(internal_user_id, purpose, consumed_at);
    `)

    console.log('Migration 001: extended magic_links table successfully')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_magic_links_internal_user_purpose`)
    await sequelize.query(`
      ALTER TABLE magic_links
        DROP COLUMN IF EXISTS purpose,
        DROP COLUMN IF EXISTS internal_user_id;
    `)
    console.log('Migration 001: rolled back magic_links extension')
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
  console.log('Usage: node 001-extend-magic-links.js <up|down>')
}

module.exports = { up, down }
