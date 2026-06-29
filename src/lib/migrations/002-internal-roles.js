const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

const { Sequelize } = require('sequelize')

const ROLES = [
  {
    name: 'Super Admin',
    description: 'Full access to everything, including TOTP resets and gate overrides',
  },
  {
    name: 'Implementation Manager',
    description: 'Create/configure tenants, manage onboarding, send NDA/contracts, invite admins, set modules, set plan/status within allowed rules',
  },
  {
    name: 'Customer Success',
    description: 'View tenants/leads, manage onboarding checklist, add internal notes, resend invites where allowed',
  },
  {
    name: 'Support',
    description: 'Troubleshoot, resend invites, unlock users, view logs, read-only impersonation',
  },
  {
    name: 'Finance/Admin',
    description: 'View plan, billing, contract, commercial fields only',
  },
  {
    name: 'Engineering',
    description: 'View diagnostics, integration health, provisioning logs, usage/errors, technical metadata',
  },
  {
    name: 'Read-only Auditor',
    description: 'View everything, change nothing, no impersonation',
  },
]

async function up() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS internal_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `)

    for (const role of ROLES) {
      await sequelize.query(
        `INSERT INTO internal_roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING;`,
        { bind: [role.name, role.description] },
      )
    }

    await sequelize.query(`
      ALTER TABLE internal_users
        ADD COLUMN IF NOT EXISTS internal_role_id UUID REFERENCES internal_roles(id);
    `)

    console.log('Migration 002: created internal_roles table, seeded roles, added FK on internal_users')
  } finally {
    await sequelize.close()
  }
}

async function down() {
  const url = process.env.DATABASE_URL || 'postgresql://localhost:5432/niticore_admin'
  const sequelize = new Sequelize(url, { dialect: 'postgres', logging: console.log })

  try {
    await sequelize.query(`
      ALTER TABLE internal_users DROP COLUMN IF EXISTS internal_role_id;
    `)
    await sequelize.query(`DROP TABLE IF EXISTS internal_roles;`)
    console.log('Migration 002: rolled back internal_roles table and FK')
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
  console.log('Usage: node 002-internal-roles.js <up|down>')
}

module.exports = { up, down }
