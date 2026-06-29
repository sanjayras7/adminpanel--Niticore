import path from 'path'
import fs from 'fs'
import { InternalAuditEvent } from '@/lib/models/InternalAuditEvent'

beforeEach(() => {
  jest.restoreAllMocks()
})

describe('Migration: 003-create-internal-audit-events.js', () => {
  const migrationPath = path.resolve(__dirname, '../src/lib/migrations/003-create-internal-audit-events.js')

  it('migration file exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  it('exports up and down functions', () => {
    const migration = require(migrationPath)
    expect(typeof migration.up).toBe('function')
    expect(typeof migration.down).toBe('function')
  })

  it('up SQL contains CREATE TABLE IF NOT EXISTS internal_audit_events', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('CREATE TABLE IF NOT EXISTS internal_audit_events')
  })

  it('includes all required columns from the spec', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    const requiredColumns = [
      'id UUID PRIMARY KEY DEFAULT gen_random_uuid()',
      'actor_internal_user_id UUID NOT NULL',
      'actor_role VARCHAR(255) NOT NULL',
      'action VARCHAR(255) NOT NULL',
      'target_type VARCHAR(255) NOT NULL',
      'target_id VARCHAR(255) NOT NULL',
      'organization_id UUID',
      'lead_id UUID',
      'before_values JSONB',
      'after_values JSONB',
      'reason TEXT',
      'metadata JSONB',
      'ip_address VARCHAR(45)',
      'user_agent TEXT',
      'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
    ]
    for (const col of requiredColumns) {
      expect(content).toContain(col)
    }
  })

  it('creates indexes on actor, target, action, organization, and created_at', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('idx_internal_audit_events_actor')
    expect(content).toContain('idx_internal_audit_events_target')
    expect(content).toContain('idx_internal_audit_events_action')
    expect(content).toContain('idx_internal_audit_events_organization')
    expect(content).toContain('idx_internal_audit_events_created_at')
  })

  it('down SQL drops all indexes and the table', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('DROP INDEX IF EXISTS idx_internal_audit_events_actor')
    expect(content).toContain('DROP INDEX IF EXISTS idx_internal_audit_events_target')
    expect(content).toContain('DROP INDEX IF EXISTS idx_internal_audit_events_action')
    expect(content).toContain('DROP INDEX IF EXISTS idx_internal_audit_events_organization')
    expect(content).toContain('DROP INDEX IF EXISTS idx_internal_audit_events_created_at')
    expect(content).toContain('DROP TABLE IF EXISTS internal_audit_events')
  })
})

describe('InternalAuditEvent model', () => {
  it('has the correct table name', () => {
    expect(InternalAuditEvent.tableName).toBe('internal_audit_events')
    expect((InternalAuditEvent.options as any).tableName).toBe('internal_audit_events')
  })

  it('has timestamps disabled', () => {
    expect((InternalAuditEvent.options as any).timestamps).toBe(false)
  })

  it('is underscored', () => {
    expect((InternalAuditEvent.options as any).underscored).toBe(true)
  })

  it('has all required attributes defined', () => {
    const attributes = InternalAuditEvent.getAttributes()
    const expectedAttrs = [
      'id', 'actor_internal_user_id', 'actor_role', 'action',
      'target_type', 'target_id', 'organization_id', 'lead_id',
      'before_values', 'after_values', 'reason', 'metadata',
      'ip_address', 'user_agent', 'created_at',
    ]
    for (const attr of expectedAttrs) {
      expect(attributes[attr]).toBeDefined()
    }
  })

  it('id is UUID primary key', () => {
    const idAttr = InternalAuditEvent.getAttributes().id
    expect(idAttr.primaryKey).toBe(true)
  })

  it('required fields are not nullable', () => {
    const attrs = InternalAuditEvent.getAttributes()
    expect(attrs.actor_internal_user_id.allowNull).toBe(false)
    expect(attrs.actor_role.allowNull).toBe(false)
    expect(attrs.action.allowNull).toBe(false)
    expect(attrs.target_type.allowNull).toBe(false)
    expect(attrs.target_id.allowNull).toBe(false)
  })

  it('optional fields are nullable', () => {
    const attrs = InternalAuditEvent.getAttributes()
    expect(attrs.organization_id.allowNull).toBe(true)
    expect(attrs.lead_id.allowNull).toBe(true)
    expect(attrs.before_values.allowNull).toBe(true)
    expect(attrs.after_values.allowNull).toBe(true)
    expect(attrs.reason.allowNull).toBe(true)
    expect(attrs.metadata.allowNull).toBe(true)
    expect(attrs.ip_address.allowNull).toBe(true)
    expect(attrs.user_agent.allowNull).toBe(true)
  })

  it('JSONB fields accept objects', () => {
    const attrs = InternalAuditEvent.getAttributes()
    expect(attrs.before_values.type.constructor.key).toBe('JSONB')
    expect(attrs.after_values.type.constructor.key).toBe('JSONB')
    expect(attrs.metadata.type.constructor.key).toBe('JSONB')
  })

  it('model does not have update or destroy exposed on module exports', () => {
    const exports = Object.keys(InternalAuditEvent)
    expect(exports).not.toContain('destroy')
  })
})

describe('Model index exports', () => {
  it('InternalAuditEvent is exported from models index', () => {
    const models = require('@/lib/models')
    expect(models.InternalAuditEvent).toBeDefined()
  })
})
