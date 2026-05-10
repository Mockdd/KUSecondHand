/**
 * 포맷 유틸리티
 *
 * 교환학생 특화 기능에서 자주 쓰이는 포맷 함수 모음.
 * 날짜는 한국 시간 기준으로 표시.
 */

// ──────────────────────────────────────────────────────────────────────────────
// 가격 포맷
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 가격을 한국 원(₩) 형식으로 포맷
 *
 * @example formatPrice(35000) → "35,000원"
 */
export const formatPrice = (price: number): string => {
  return `${price.toLocaleString('ko-KR')}원`
}

/**
 * 숫자를 천 단위 구분 포맷 (단위 없음)
 *
 * @example formatNumber(35000) → "35,000"
 */
export const formatNumber = (value: number): string => {
  return value.toLocaleString('ko-KR')
}

// ──────────────────────────────────────────────────────────────────────────────
// 날짜 포맷
// ──────────────────────────────────────────────────────────────────────────────

/**
 * ISO 날짜 문자열을 날짜 형식으로 포맷
 *
 * @example formatDate("2026-05-05T14:00:00Z") → "2026.05.05"
 */
export const formatDate = (isoString: string): string => {
  const date = new Date(isoString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '.').replace(/\.$/, '')
}

/**
 * ISO 날짜 문자열을 날짜+시간 형식으로 포맷
 *
 * @example formatDateTime("2026-05-05T14:00:00Z") → "2026.05.05 23:00"
 */
export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  }).replace(/\. /g, '.')
}

/**
 * ISO 날짜 문자열을 채팅 메시지용 시간 형식으로 포맷
 *
 * @example formatChatTime("2026-05-05T14:00:00Z") → "오후 11:00"
 */
export const formatChatTime = (isoString: string): string => {
  const date = new Date(isoString)
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })
}

/**
 * ISO 날짜를 상대 시간으로 포맷 (채팅 목록, 알림 등)
 *
 * @example formatRelativeTime("2026-05-05T14:00:00Z") → "3일 전"
 */
export const formatRelativeTime = (isoString: string): string => {
  const now = new Date()
  const date = new Date(isoString)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 1000 / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`
  return formatDate(isoString)
}

// ──────────────────────────────────────────────────────────────────────────────
// 학기 포맷
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 학기 문자열을 사람이 읽기 좋은 형식으로 변환
 *
 * @example formatSemester("2026-1") → "2026년 1학기"
 * @example formatSemester("2026-2") → "2026년 2학기"
 */
export const formatSemester = (semester: string): string => {
  const [year, term] = semester.split('-')
  if (!year || !term) return semester
  return `${year}년 ${term}학기`
}

/**
 * 현재 연도 기준 학기 선택 옵션 생성
 * 현재 학기 + 이전 2개 학기 반환
 */
export const getSemesterOptions = (): Array<{ value: string; label: string }> => {
  const now = new Date()
  const year = now.getFullYear()
  const options: Array<{ value: string; label: string }> = []

  for (let y = year; y >= year - 1; y--) {
    for (const term of [2, 1]) {
      const value = `${y}-${term}`
      options.push({ value, label: formatSemester(value) })
    }
  }

  return options.slice(0, 4) // 최근 4개 학기
}

// ──────────────────────────────────────────────────────────────────────────────
// 비율 포맷
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 보유율을 퍼센트 문자열로 변환
 *
 * @example formatOwnershipRate(0.8, 8, 10) → "8/10 보유 (80%)"
 */
export const formatOwnershipRate = (
  rate: number,
  owned: number,
  total: number
): string => {
  const percent = Math.round(rate * 100)
  return `${owned}/${total} 보유 (${percent}%)`
}

/**
 * 점수를 소수점 둘째 자리까지 반올림한 문자열로 변환
 *
 * @example formatScore(0.86) → "0.86"
 */
export const formatScore = (score: number): string => {
  return score.toFixed(2)
}

// ──────────────────────────────────────────────────────────────────────────────
// 물품 상태 포맷
// ──────────────────────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  new: '새것',
  like_new: '거의 새것',
  good: '양호',
  fair: '보통',
  poor: '하',
}

/**
 * 물품 상태 코드를 한국어로 변환
 *
 * @example formatCondition("good") → "양호"
 */
export const formatCondition = (condition: string): string => {
  return CONDITION_LABELS[condition] ?? condition
}
