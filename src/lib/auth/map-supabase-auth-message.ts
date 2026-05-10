/**
 * Supabase Auth 오류 메시지(영문 위주)를 사용자용 한글로 바꿉니다.
 */
export function mapSignInWithPasswordError(message: string): string {
  const m = message.toLowerCase()
  if (
    m.includes('invalid login credentials') ||
    m.includes('invalid email or password') ||
    m.includes('invalid credentials')
  ) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }
  if (m.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다.'
  }
  if (m.includes('too many requests') || m.includes('rate limit') || m.includes('over_request_rate')) {
    return '잠시 후 다시 시도해 주세요.'
  }
  if (m.includes('user not found')) {
    return '해당 이메일로 가입된 계정이 없습니다.'
  }
  return '로그인에 실패했습니다. 다시 시도해 주세요.'
}

export function mapEmailOtpVerifyError(message: string): string {
  const m = message.toLowerCase()
  if (
    m.includes('expired') ||
    m.includes('invalid token') ||
    m.includes('invalid otp') ||
    m.includes('invalid link') ||
    m.includes('email link is invalid') ||
    m.includes('already been used') ||
    m.includes('otp_expired')
  ) {
    return '인증번호가 만료되었거나 올바르지 않습니다.'
  }
  if (m.includes('too many requests') || m.includes('rate limit') || m.includes('over_request_rate')) {
    return '잠시 후 다시 시도해 주세요.'
  }
  return '인증에 실패했습니다. 다시 시도해 주세요.'
}
