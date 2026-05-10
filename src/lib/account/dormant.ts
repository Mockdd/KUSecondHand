/** 로그인/활동 없이 경과하면 휴면 처리 기준 (일) */
export function getDormantInactiveDays(): number {
  const raw = process.env.DORMANT_INACTIVE_DAYS
  const n = raw ? Number.parseInt(raw, 10) : 365
  return Number.isFinite(n) && n > 0 ? n : 365
}

export function inactiveCutoffIso(): string {
  const days = getDormantInactiveDays()
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}
