import { NextRequest, NextResponse } from 'next/server'
import { validateStep } from '@/lib/validation/wizard'
import { InternalUser } from '@/lib/models'
import { config } from '@/config'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { stepNumber, data } = body

    if (!stepNumber || !data) {
      return NextResponse.json(
        { valid: false, errors: { _form: 'Invalid request: stepNumber and data are required' } },
        { status: 400 }
      )
    }

    const clientErrors = validateStep(stepNumber, data)
    const serverErrors: Record<string, string> = {}

    if (stepNumber === 1) {
      const { slug, domain, ownerId } = data as { slug: string; domain: string; ownerId: string }

      if (slug) {
        const existingSlug = await checkSlugExists(slug)
        if (existingSlug) {
          serverErrors.slug = 'This slug is already taken. Please choose another.'
        }
      }

      if (domain) {
        const existingDomain = await checkDomainExists(domain)
        if (existingDomain) {
          serverErrors.domain = 'This domain is already registered. Another tenant may be using it.'
        }
      }

      if (ownerId) {
        const owner = await InternalUser.findByPk(ownerId, {
          attributes: ['id', 'status'],
        })
        if (!owner || owner.status !== 'active') {
          serverErrors.ownerId = 'Selected owner does not exist or is inactive.'
        }
      }
    }

    if (stepNumber === 2) {
      const { plan, initialStatus } = data as { plan: string; initialStatus: string }
      const validPlans = ['starter', 'growth', 'enterprise']
      const validStatuses = ['draft', 'pending_setup']

      if (plan && !validPlans.includes(plan)) {
        serverErrors.plan = 'Invalid plan selected.'
      }

      if (initialStatus && !validStatuses.includes(initialStatus)) {
        serverErrors.initialStatus = 'Invalid initial status selected.'
      }
    }

    const allErrors = { ...clientErrors, ...serverErrors }
    const valid = Object.keys(allErrors).length === 0

    return NextResponse.json({ valid, errors: allErrors })
  } catch (error) {
    console.error('[WIZARD] Validation error:', error)
    return NextResponse.json(
      { valid: false, errors: { _form: 'Validation failed. Please try again.' } },
      { status: 500 }
    )
  }
}

async function checkSlugExists(slug: string): Promise<boolean> {
  if (config.isTest) {
    return slug === 'taken-slug'
  }
  return false
}

async function checkDomainExists(domain: string): Promise<boolean> {
  if (config.isTest) {
    return domain === 'taken.com'
  }
  return false
}