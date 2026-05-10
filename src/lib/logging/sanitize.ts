/**
 * 디버그·서버 로그용 — 원문 이메일/토큰 전체를 남기지 않도록 할 때 사용.
 */

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'password_hash',
  'access_token',
  'refresh_token',
  'token',
  'apikey',
  'api_key',
  'secret',
])

/** 로그에 넣기 위한 이메일 마스킹 (로컬파트 중간만 가림) */
export function maskEmail(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  if (at <= 0) return '[invalid]'
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  if (!domain) return '[invalid]'
  const head = local.slice(0, 2)
  return `${head}***@${domain}`
}

/** 얕은 객체 복사본에서 흔한 민감 키 값을 마스킹 (중첩은 1단계만) */
export function redactShallowForLog(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    const low = k.toLowerCase()
    if (SENSITIVE_KEYS.has(low)) {
      out[k] = '[redacted]'
      continue
    }
    if (low === 'email' && typeof v === 'string') {
      out[k] = maskEmail(v)
      continue
    }
    out[k] = v
  }
  return out
}
