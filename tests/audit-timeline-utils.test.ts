import { formatTimeAgo, truncateUuid, buildActorLabel } from '@/lib/audit-timeline-utils'

describe('formatTimeAgo', () => {
  it('returns "just now" for dates within the last second', () => {
    expect(formatTimeAgo(new Date().toISOString())).toBe('just now')
  })

  it('returns "just now" for dates within the last 59 seconds', () => {
    const date = new Date(Date.now() - 30 * 1000).toISOString()
    expect(formatTimeAgo(date)).toBe('just now')
  })

  it('returns minutes ago for dates within the last hour', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatTimeAgo(date)).toBe('5m ago')
  })

  it('returns hours ago for dates within the last 24 hours', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(date)).toBe('3h ago')
  })

  it('returns days ago for dates within the last week', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(date)).toBe('2d ago')
  })

  it('returns weeks ago for dates within the last 5 weeks', () => {
    const date = new Date(Date.now() - 3 * 7 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(date)).toBe('3w ago')
  })

  it('returns months ago for dates within the last 12 months', () => {
    const date = new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(date)).toBe('4mo ago')
  })

  it('returns a formatted date for dates older than 12 months', () => {
    const date = new Date('2024-01-15T12:00:00Z').toISOString()
    const result = formatTimeAgo(date)
    expect(result).toContain('Jan')
    expect(result).toContain('2024')
    expect(result).toContain('15')
  })
})

describe('truncateUuid', () => {
  it('truncates a full UUID to first 8 characters with ellipsis', () => {
    expect(truncateUuid('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400…')
  })

  it('returns short strings unchanged', () => {
    expect(truncateUuid('abc')).toBe('abc')
  })

  it('returns 8-character strings unchanged', () => {
    expect(truncateUuid('12345678')).toBe('12345678')
  })

  it('truncates strings just over 8 characters', () => {
    expect(truncateUuid('123456789')).toBe('12345678…')
  })
})

describe('buildActorLabel', () => {
  it('returns "System" for system actor', () => {
    expect(buildActorLabel('System', '')).toBe('System')
    expect(buildActorLabel('System', null)).toBe('System')
    expect(buildActorLabel('System', 'Super Admin')).toBe('System')
  })

  it('includes role when provided and not "unknown"', () => {
    expect(buildActorLabel('user-abc', 'Super Admin')).toBe('user-abc (Super Admin)')
    expect(buildActorLabel('user-abc', 'Support')).toBe('user-abc (Support)')
  })

  it('omits role when it is "unknown"', () => {
    expect(buildActorLabel('user-abc', 'unknown')).toBe('user-abc')
  })

  it('omits role when it is null', () => {
    expect(buildActorLabel('user-abc', null)).toBe('user-abc')
  })

  it('returns actor id when role is empty string', () => {
    expect(buildActorLabel('user-abc', '')).toBe('user-abc')
  })
})
