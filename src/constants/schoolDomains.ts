/** 고려대학교 공식 메일: 주소가 반드시 `@korea.ac.kr` 로 끝나야 함 */
export const REQUIRED_EMAIL_SUFFIX = '@korea.ac.kr'

export function isAllowedSchoolEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) return false
  return normalized.endsWith(REQUIRED_EMAIL_SUFFIX)
}
