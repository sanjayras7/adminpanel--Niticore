import { config } from '@/config'

interface RateLimitEntry {
  count: number
  resetAt: number
}

export const rateLimitStore = new Map<string, RateLimitEntry>()

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.rateLimit.windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= config.rateLimit.maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

export function checkEmailRateLimit(email: string): boolean {
  const now = Date.now()
  const key = `email:${email}`
  const windowMs = config.rateLimit.emailWindowMs
  const entry = rateLimitStore.get(key)

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= config.rateLimit.maxPerEmailHour) {
    return false
  }

  entry.count += 1
  return true
}

export function resetRateLimiter(): void {
  rateLimitStore.clear()
}
