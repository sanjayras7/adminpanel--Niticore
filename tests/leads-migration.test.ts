import path from 'path'
import fs from 'fs'

describe('Migration: 004-add-lead-duplicate-flags.js', () => {
  const migrationPath = path.resolve(__dirname, '../src/lib/migrations/004-add-lead-duplicate-flags.js')

  it('migration file exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  it('exports up and down functions', () => {
    const migration = require(migrationPath)
    expect(typeof migration.up).toBe('function')
    expect(typeof migration.down).toBe('function')
  })

  it('up SQL adds potential_duplicate_ids column', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('potential_duplicate_ids')
    expect(content).toContain('ALTER TABLE leads')
    expect(content).toContain('JSONB')
  })

  it('up SQL creates GIN index on potential_duplicate_ids', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('idx_leads_potential_duplicate_ids')
    expect(content).toContain('USING GIN')
  })

  it('down SQL drops index and column', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('DROP INDEX IF EXISTS idx_leads_potential_duplicate_ids')
    expect(content).toContain('ALTER TABLE leads DROP COLUMN IF EXISTS potential_duplicate_ids')
  })
})
