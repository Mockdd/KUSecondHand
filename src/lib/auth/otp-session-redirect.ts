/** 메일 매직링크로 돌아올 때(next 쿼리 유실 등) 브라우저에만 백업 */
const KEY = 'email_otp_next_path'

export function setPendingEmailOtpNext(path: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    /* noop */
  }
}

export function takePendingEmailOtpNext(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return v
  } catch {
    return null
  }
}
