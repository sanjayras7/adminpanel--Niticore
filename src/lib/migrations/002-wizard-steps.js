const { Sequelize } = require('sequelize')

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      ALTER TABLE internal_users
        ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);
    `)

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS organization_admin_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL,
        internal_user_id UUID NOT NULL REFERENCES internal_users(id),
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','sent','accepted','expired')),
        invited_by UUID REFERENCES internal_users(id),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_org_admin_invites_org_user
        ON organization_admin_invites(organization_id, internal_user_id);
    `)

    console.log('Migration 002: added job_title to internal_users, created organization_admin_invites')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`DROP INDEX IF EXISTS idx_org_admin_invites_org_user`)
    await sequelize.query(`DROP TABLE IF EXISTS organization_admin_invites`)
    await sequelize.query(`ALTER TABLE internal_users DROP COLUMN IF EXISTS job_title`)
    console.log('Migration 002: rolled back wizard steps changes')
  } finally {
    await sequelize.close()
  }
}

module.exports = { up, down }
