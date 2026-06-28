import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { Lead } from '@/lib/models/Lead'
import { logAuditEvent } from '@/lib/audit'
import { sequelize } from '@/lib/sequelize'
import { findDuplicateLeads, DuplicateMatch } from '@/lib/duplicate-detection'

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

const ALLOWED_FIELDS = new Set([
  'company_name',
  'contact_first_name',
  'contact_last_name',
  'work_email',
  'phone',
  'company_domain',
  'company_website',
  'country',
  'region',
  'company_size',
  'interested_modules_json',
  'interested_frameworks_json',
  'message',
])

const REQUIRED_FIELDS = ['company_name', 'contact_first_name', 'contact_last_name', 'work_email']

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRequired(body: Record<string, unknown>): string[] {
  const missing: string[] = []
  for (const field of REQUIRED_FIELDS) {
    if (!body[field] || typeof body[field] !== 'string' || body[field].trim() === '') {
      missing.push(field)
    }
  }
  return missing
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'malformed_json', message: 'Request body is not valid JSON.' },
      { status: 400 },
    )
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'malformed_json', message: 'Request body must be a JSON object.' },
      { status: 400 },
    )
  }

  const missing = validateRequired(body)
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'missing_fields', message: `Missing required field(s): ${missing.join(', ')}`, fields: missing },
      { status: 422 },
    )
  }

  const workEmail = String(body.work_email).trim()
  if (!EMAIL_REGEX.test(workEmail)) {
    return NextResponse.json(
      { error: 'invalid_email', message: 'work_email is not a valid email address.' },
      { status: 422 },
    )
  }

  const whitelisted: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body && body[key] !== undefined && body[key] !== null) {
      whitelisted[key] = body[key]
    }
  }

  whitelisted.company_name = String(whitelisted.company_name).trim()
  whitelisted.contact_first_name = String(whitelisted.contact_first_name).trim()
  whitelisted.contact_last_name = String(whitelisted.contact_last_name).trim()
  whitelisted.work_email = workEmail

  if (typeof whitelisted.phone === 'string') {
    whitelisted.phone = whitelisted.phone.trim()
  }
  if (typeof whitelisted.company_domain === 'string') {
    whitelisted.company_domain = whitelisted.company_domain.trim()
  }
  if (typeof whitelisted.company_website === 'string') {
    whitelisted.company_website = whitelisted.company_website.trim()
  }
  if (typeof whitelisted.country === 'string') {
    whitelisted.country = whitelisted.country.trim()
  }
  if (typeof whitelisted.region === 'string') {
    whitelisted.region = whitelisted.region.trim()
  }
  if (typeof whitelisted.company_size === 'string') {
    whitelisted.company_size = whitelisted.company_size.trim()
  }
  if (typeof whitelisted.message === 'string') {
    whitelisted.message = whitelisted.message.trim()
  }

  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const userAgent = request.headers.get('user-agent') || undefined

  const transaction = await sequelize.transaction()

  try {
    const lead = await Lead.create(
      {
        id: uuidv4(),
        ...whitelisted,
        source: 'Website Form',
        status: 'New',
        nda_required: false,
      } as Lead,
      { transaction },
    )

    await logAuditEvent({
      actorInternalUserId: SYSTEM_USER_ID,
      actorRole: 'System',
      action: 'lead.intake',
      targetType: 'lead',
      targetId: lead.id,
      afterValues: { source: 'Website Form', status: 'New', company_name: lead.company_name, work_email: lead.work_email },
      ipAddress,
      userAgent,
    })

    await transaction.commit()

    let potentialDuplicates: DuplicateMatch[] | null = null

    try {
      const companyDomain = (whitelisted.company_domain as string | null) || null
      const matchedLeads = await findDuplicateLeads(lead.id, companyDomain, lead.work_email)

      if (matchedLeads.length > 0) {
        await Lead.update(
          { potential_duplicate_ids: matchedLeads.map((m) => m.id) },
          { where: { id: lead.id } },
        )

        await logAuditEvent({
          actorInternalUserId: SYSTEM_USER_ID,
          actorRole: 'System',
          action: 'lead_duplicate_flag',
          targetType: 'lead',
          targetId: lead.id,
          afterValues: {
            matched_ids: matchedLeads.map((m) => m.id),
            match_types: [...new Set(matchedLeads.map((m) => m.matched_on))],
          },
          ipAddress,
          userAgent,
        })

        potentialDuplicates = matchedLeads
      }
    } catch (err) {
      console.error('[LEADS] Duplicate scan failed:', err)
    }

    return NextResponse.json(
      {
        id: lead.id,
        company_name: lead.company_name,
        contact_first_name: lead.contact_first_name,
        contact_last_name: lead.contact_last_name,
        work_email: lead.work_email,
        phone: lead.phone,
        company_domain: lead.company_domain,
        source: lead.source,
        status: lead.status,
        created_at: lead.created_at.toISOString(),
        potential_duplicates: potentialDuplicates,
      },
      { status: 201 },
    )
  } catch (err) {
    await transaction.rollback()
    console.error('[LEADS] Failed to create lead:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'An unexpected error occurred. Please try again later.' },
      { status: 500 },
    )
  }
}
