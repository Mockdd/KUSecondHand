// 현재 날짜로부터 학기 문자열 파생 (예: '2026-1', '2026-2')
// 3~8월: 1학기 / 9~2월: 2학기
export function getCurrentSemester(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const isFirstSemester = month >= 3 && month <= 8
  const semester = isFirstSemester ? 1 : 2
  const semesterYear = !isFirstSemester && month <= 2 ? year - 1 : year

  return `${semesterYear}-${semester}`
}
