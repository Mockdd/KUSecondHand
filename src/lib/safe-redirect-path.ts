/** 내부 이동용 경로(+쿼리)만 허용. 무효면 null */
export function safeInternalNavigatePath(next: string | null | undefined): string | null {
  const v = next?.trim()
  if (!v) return null
  if (!v.startsWith('/') || v.startsWith('//')) return null
  return v
}

/** 클라이언트·서버 공통 — 오픈 리다이렉트 방지 */
export function sanitizeNextPath(next: string | null, fallback = '/'): string {
  return safeInternalNavigatePath(next) ?? fallback
}
