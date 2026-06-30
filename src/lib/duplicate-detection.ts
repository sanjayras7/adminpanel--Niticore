import { Op, fn, col, where } from 'sequelize'
import { Lead } from '@/lib/models/Lead'

export interface DuplicateMatch {
  id: string
  company_name: string
  contact_first_name: string
  contact_last_name: string
  matched_on: 'company_domain' | 'email_domain'
}

export function extractEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') return null
  const atIndex = email.indexOf('@')
  if (atIndex === -1 || atIndex === email.length - 1) return null
  return email.slice(atIndex + 1).toLowerCase()
}

export async function findDuplicateLeads(
  newLeadId: string,
  companyDomain: string | null,
  workEmail: string | null,
): Promise<DuplicateMatch[]> {
  const emailDomain = workEmail ? extractEmailDomain(workEmail) : null

  if (!companyDomain && !emailDomain) {
    return []
  }

  const matchMap = new Map<string, DuplicateMatch>()

  if (companyDomain) {
    const normalized = companyDomain.toLowerCase()
    const matches = await Lead.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.ne]: newLeadId } },
          {
            [Op.or]: [
              where(fn('LOWER', col('company_domain')), normalized),
              where(fn('LOWER', fn('SPLIT_PART', col('work_email'), '@', 2)), normalized),
            ],
          },
        ],
      },
      attributes: ['id', 'company_name', 'contact_first_name', 'contact_last_name'],
    })

    for (const match of matches) {
      if (!matchMap.has(match.id)) {
        matchMap.set(match.id, {
          id: match.id,
          company_name: match.company_name,
          contact_first_name: match.contact_first_name,
          contact_last_name: match.contact_last_name,
          matched_on: 'company_domain',
        })
      }
    }
  }

  if (emailDomain) {
    const matches = await Lead.findAll({
      where: {
        [Op.and]: [
          { id: { [Op.ne]: newLeadId } },
          {
            [Op.or]: [
              where(fn('LOWER', col('company_domain')), emailDomain),
              where(fn('LOWER', fn('SPLIT_PART', col('work_email'), '@', 2)), emailDomain),
            ],
          },
        ],
      },
      attributes: ['id', 'company_name', 'contact_first_name', 'contact_last_name'],
    })

    for (const match of matches) {
      if (!matchMap.has(match.id)) {
        matchMap.set(match.id, {
          id: match.id,
          company_name: match.company_name,
          contact_first_name: match.contact_first_name,
          contact_last_name: match.contact_last_name,
          matched_on: 'email_domain',
        })
      }
    }
  }

  return Array.from(matchMap.values())
}
