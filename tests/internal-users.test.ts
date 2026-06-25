import path from 'path'
import fs from 'fs'
import { InternalUser, InternalUserAttributes } from '@/lib/models/InternalUser'

describe('Migration: 000-create-internal-users-table.js', () => {
  const migrationPath = path.resolve(__dirname, '../src/lib/migrations/000-create-internal-users-table.js')

  it('migration file exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  it('exports up and down functions', () => {
    const migration = require(migrationPath)
    expect(typeof migration.up).toBe('function')
    expect(typeof migration.down).toBe('function')
  })

  it('up SQL contains CREATE TABLE IF NOT EXISTS internal_users', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('CREATE TABLE IF NOT EXISTS internal_users')
  })

  it('up SQL creates unique index on email', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_internal_users_email')
    expect(content).toContain('ON internal_users(email)')
  })

  it('up SQL creates index on deleted_at', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('CREATE INDEX IF NOT EXISTS idx_internal_users_deleted_at')
    expect(content).toContain('ON internal_users(deleted_at)')
  })

  it('down SQL drops the table and indexes', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('DROP TABLE IF EXISTS internal_users')
    expect(content).toContain('DROP INDEX IF EXISTS idx_internal_users_email')
    expect(content).toContain('DROP INDEX IF EXISTS idx_internal_users_deleted_at')
  })

  it('includes all required columns from the spec', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    const requiredColumns = [
      'id UUID PRIMARY KEY',
      'name VARCHAR(255) NOT NULL',
      'surname VARCHAR(255) NOT NULL',
      'email VARCHAR(320) NOT NULL',
      'internal_role_id UUID',
      'status VARCHAR(50) NOT NULL DEFAULT',
      'totp_enabled BOOLEAN NOT NULL DEFAULT',
      'totp_secret_encrypted TEXT',
      'totp_enrolled_at TIMESTAMPTZ',
      'totp_reset_at TIMESTAMPTZ',
      'totp_reset_by UUID',
      'totp_reset_reason TEXT',
      'last_login_at TIMESTAMPTZ',
      'last_totp_verified_at TIMESTAMPTZ',
      'failed_totp_attempt_count INTEGER NOT NULL DEFAULT',
      'locked_until TIMESTAMPTZ',
      'created_at TIMESTAMPTZ NOT NULL DEFAULT',
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT',
      'deleted_at TIMESTAMPTZ',
    ]
    for (const col of requiredColumns) {
      expect(content).toContain(col)
    }
  })
})

describe('InternalUser model', () => {
  it('has the correct table configuration', () => {
    expect(InternalUser.tableName).toBe('internal_users')
    expect((InternalUser.options as any).tableName).toBe('internal_users')
    expect((InternalUser.options as any).timestamps).toBe(true)
    expect((InternalUser.options as any).underscored).toBe(true)
    expect((InternalUser.options as any).paranoid).toBe(true)
  })

  it('has all required attributes defined', () => {
    const attributes = InternalUser.getAttributes()
    const expectedAttrs = [
      'id', 'name', 'surname', 'email', 'internal_role_id',
      'status', 'totp_enabled', 'totp_secret_encrypted',
      'totp_enrolled_at', 'totp_reset_at', 'totp_reset_by', 'totp_reset_reason',
      'last_login_at', 'last_totp_verified_at', 'failed_totp_attempt_count',
      'locked_until', 'created_at', 'updated_at', 'deleted_at',
    ]
    for (const attr of expectedAttrs) {
      expect(attributes[attr]).toBeDefined()
    }
  })

  it('email attribute has unique constraint', () => {
    const emailAttr = InternalUser.getAttributes().email
    expect(emailAttr.unique).toBe(true)
    expect(emailAttr.allowNull).toBe(false)
  })

  it('id is UUID primary key', () => {
    const idAttr = InternalUser.getAttributes().id
    expect(idAttr.primaryKey).toBe(true)
  })

  it('supports soft delete with deleted_at', () => {
    const deletedAttr = InternalUser.getAttributes().deleted_at
    expect(deletedAttr.allowNull).toBe(true)
  })

  it('internal_role_id is nullable (FK deferred to Issue 2a)', () => {
    const roleAttr = InternalUser.getAttributes().internal_role_id
    expect(roleAttr.allowNull).toBe(true)
  })

  it('status has a default value of active', () => {
    const statusAttr = InternalUser.getAttributes().status
    expect(statusAttr.defaultValue).toBe('active')
  })

  it('totp_enabled defaults to false', () => {
    const totpAttr = InternalUser.getAttributes().totp_enabled
    expect(totpAttr.defaultValue).toBe(false)
  })

  it('failed_totp_attempt_count defaults to 0', () => {
    const countAttr = InternalUser.getAttributes().failed_totp_attempt_count
    expect(countAttr.defaultValue).toBe(0)
  })
})

describe('InternalUserAttributes interface type', () => {
  it('interface compiles with all expected fields', () => {
    const user: InternalUserAttributes = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'John',
      surname: 'Doe',
      email: 'john@example.com',
      internal_role_id: null,
      status: 'active',
      totp_enabled: false,
      totp_secret_encrypted: null,
      totp_enrolled_at: null,
      totp_reset_at: null,
      totp_reset_by: null,
      totp_reset_reason: null,
      last_login_at: null,
      last_totp_verified_at: null,
      failed_totp_attempt_count: 0,
      locked_until: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    }
    expect(user.name).toBe('John')
    expect(user.email).toBe('john@example.com')
    expect(user.status).toBe('active')
    expect(Object.keys(user).length).toBe(19)
  })

  it('status only allows valid enum values', () => {
    const validStatuses: InternalUserAttributes['status'][] = ['active', 'inactive', 'locked']
    expect(validStatuses).toContain('active')
    expect(validStatuses).toContain('inactive')
    expect(validStatuses).toContain('locked')
  })
})

describe('Model index exports', () => {
  it('InternalUser is exported from models index', () => {
    const models = require('@/lib/models')
    expect(models.InternalUser).toBeDefined()
  })
})
