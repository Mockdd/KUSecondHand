const NICKNAME_MIN = 2
const NICKNAME_MAX = 50
const PASSWORD_MIN = 8
const OTP_LEN = 6

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`
  }
  return null
}

export function validateNickname(nickname: string): string | null {
  const t = nickname.trim()
  if (t.length < NICKNAME_MIN || t.length > NICKNAME_MAX) {
    return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력하세요.`
  }
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(t)) {
    return '닉네임은 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.'
  }
  return null
}

export function validateStudentId(id: string): string | null {
  const t = id.trim()
  if (!t.length) return '학번을 입력하세요.'
  if (t.length > 20) return '학번이 너무 깁니다.'
  return null
}

export function normalizeOtp(token: string): string {
  return token.replace(/\D/g, '').slice(0, OTP_LEN)
}

export const PASSWORD_MIN_LENGTH = PASSWORD_MIN

const BIO_MAX = 500

export function validateBio(bio: string | null | undefined): string | null {
  if (bio == null || bio === '') return null
  if (bio.length > BIO_MAX) {
    return `한 줄 소개는 ${BIO_MAX}자 이하로 입력하세요.`
  }
  return null
}
