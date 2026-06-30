import { config } from '@/config'

export interface EmailPayload {
  to: string
  subject: string
  body: string
}

export async function sendMagicLinkEmail(email: string, token: string, otp: string): Promise<void> {
  const linkUrl = `${config.email.magicLinkBaseUrl}?token=${token}`

  const payload: EmailPayload = {
    to: email,
    subject: 'Your magic link for Niticore Admin',
    body: `Click the link below to sign in to Niticore Admin:\n\n${linkUrl}\n\nOr use the one-time code: ${otp}\n\nThis link and code will expire in ${config.jwt.magicLinkExpiryMinutes} minutes.`,
  }

  if (config.isTest) {
    return
  }

  try {
    const { hostname } = new URL(config.email.magicLinkBaseUrl)

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log(`[EMAIL] To: ${payload.to}`)
      console.log(`[EMAIL] Subject: ${payload.subject}`)
      console.log(`[EMAIL] Body:\n${payload.body}`)
      return
    }

    console.error(`[EMAIL] No email provider configured for ${hostname}. Email would be sent:`)
    console.error(`[EMAIL] To: ${payload.to}, Subject: ${payload.subject}`)
  } catch (err) {
    console.error('[EMAIL] Failed to send email:', err)
  }
}

export async function sendAdminInviteEmail(email: string, adminName: string): Promise<boolean> {
  const payload: EmailPayload = {
    to: email,
    subject: 'You have been invited to Niticore Admin',
    body: `Hello ${adminName},\n\nYou have been invited to join Niticore Admin as an organization administrator.\n\nPlease check your account to accept the invitation.\n\nThis invitation will expire in 7 days.`,
  }

  if (config.isTest) {
    return true
  }

  try {
    const { hostname } = new URL(config.email.magicLinkBaseUrl)

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log(`[EMAIL] To: ${payload.to}`)
      console.log(`[EMAIL] Subject: ${payload.subject}`)
      console.log(`[EMAIL] Body:\n${payload.body}`)
      return true
    }

    console.error(`[EMAIL] No email provider configured for ${hostname}. Email would be sent:`)
    console.error(`[EMAIL] To: ${payload.to}, Subject: ${payload.subject}`)
    return false
  } catch (err) {
    console.error('[EMAIL] Failed to send admin invite email:', err)
    return false
  }
}
