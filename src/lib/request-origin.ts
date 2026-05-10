import type { NextRequest } from 'next/server'

export { sanitizeNextPath } from '@/lib/safe-redirect-path'

/** API Route 에서 브라우저 Origin 과 일치하는 절대 URL 만들기 */
export function getRequestOrigin(request: NextRequest): string {
  const h = request.headers.get('origin')
  if (h) {
    try {
      const u = new URL(h)
      return u.origin
    } catch {
      /* noop */
    }
  }
  const forwarded = request.headers.get('x-forwarded-host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (forwarded) {
    return `${proto.split(',')[0]?.trim() ?? 'https'}://${forwarded.split(',')[0]?.trim()}`
  }
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) {
    try {
      return new URL(explicit.startsWith('http') ? explicit : `https://${explicit}`).origin
    } catch {
      /* noop */
    }
  }
  return 'http://localhost:3000'
}
