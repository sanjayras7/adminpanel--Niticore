jest.mock('@/lib/models/Lead', () => ({
  Lead: { findAll: jest.fn() },
}))

import { extractEmailDomain, findDuplicateLeads } from '@/lib/duplicate-detection'
import { Lead } from '@/lib/models/Lead'

const mockLeadFindAll = (Lead as jest.Mocked<typeof Lead>).findAll as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('extractEmailDomain', () => {
  it('returns domain from valid email', () => {
    expect(extractEmailDomain('user@example.com')).toBe('example.com')
  })

  it('lowercases the domain', () => {
    expect(extractEmailDomain('User@Example.COM')).toBe('example.com')
  })

  it('returns null for null input', () => {
    expect(extractEmailDomain(null as unknown as string)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractEmailDomain('')).toBeNull()
  })

  it('returns null for string without @', () => {
    expect(extractEmailDomain('notanemail')).toBeNull()
  })

  it('returns null for string ending with @', () => {
    expect(extractEmailDomain('user@')).toBeNull()
  })

  it('returns domain from email with subdomain', () => {
    expect(extractEmailDomain('user@sub.example.com')).toBe('sub.example.com')
  })
})

describe('findDuplicateLeads', () => {
  const newLeadId = '550e8400-e29b-41d4-a716-446655440000'

  it('returns empty array when no company_domain or email domain available', async () => {
    const result = await findDuplicateLeads(newLeadId, null, 'invalid-email')
    expect(result).toEqual([])
    expect(mockLeadFindAll).not.toHaveBeenCalled()
  })

  it('returns empty array when no matches found', async () => {
    mockLeadFindAll.mockResolvedValue([])

    const result = await findDuplicateLeads(newLeadId, 'acme.com', 'user@other.com')

    expect(result).toEqual([])
  })

  it('finds matches by company_domain', async () => {
    const existing = [{
      id: 'uuid-1',
      company_name: 'Acme Corp',
      contact_first_name: 'Jane',
      contact_last_name: 'Doe',
    }]
    mockLeadFindAll.mockResolvedValue(existing)

    const result = await findDuplicateLeads(newLeadId, 'acme.com', 'jane@acme.com')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('uuid-1')
    expect(result[0].matched_on).toBe('company_domain')
  })

  it('finds matches by email domain when company_domain is missing', async () => {
    const existing = [{
      id: 'uuid-2',
      company_name: 'Other Corp',
      contact_first_name: 'Bob',
      contact_last_name: 'Brown',
    }]
    mockLeadFindAll.mockResolvedValue(existing)

    const result = await findDuplicateLeads(newLeadId, null, 'bob@shared.com')

    expect(result).toHaveLength(1)
    expect(result[0].matched_on).toBe('email_domain')
  })

  it('deduplicates same lead matching on both domains', async () => {
    const existing = [{
      id: 'uuid-3',
      company_name: 'Shared Corp',
      contact_first_name: 'Carol',
      contact_last_name: 'White',
    }]
    mockLeadFindAll.mockResolvedValue(existing)

    const result = await findDuplicateLeads(newLeadId, 'sharedcorp.com', 'carol@sharedcorp.com')

    expect(result).toHaveLength(1)
    expect(result[0].matched_on).toBe('company_domain')
  })

  it('excludes the new lead from its own duplicate check via query filter', async () => {
    mockLeadFindAll.mockResolvedValue([])

    await findDuplicateLeads(newLeadId, 'selfcorp.com', 'dave@selfcorp.com')

    const [firstCallArgs] = mockLeadFindAll.mock.calls[0]
    const whereClause = (firstCallArgs as any).where
    expect(whereClause[Symbol.for('and')][0].id[Symbol.for('ne')]).toBe(newLeadId)
  })

  it('matches case-insensitively', async () => {
    const existing = [{
      id: 'uuid-4',
      company_name: 'Case Corp',
      contact_first_name: 'Eve',
      contact_last_name: 'Gray',
    }]
    mockLeadFindAll.mockResolvedValue(existing)

    const result = await findDuplicateLeads(newLeadId, 'CASE-CORP.COM', 'eve@case-corp.com')

    expect(result).toHaveLength(1)
  })
})
