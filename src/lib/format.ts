/**
 * 표현 계층 변환 헬퍼.
 *
 * lib/queries/* 가 DB 통신만 책임진다면, 여기서는 그 결과를
 * 화면 텍스트로 옮기는 KO 매핑과 포맷터를 모은다.
 */

import type { CourseScheduleSummary } from './queries/types'

/** DB enum: day_of_week_t → 한글 1글자 */
export const DAY_KO: Record<string, string> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일',
}

/** DB enum: course_category_t → 한글 라벨 */
export const CATEGORY_KO: Record<string, string> = {
  major: '전공',
  liberal: '교양',
  teaching: '교직',
}

/**
 * course_schedules 배열을 한 줄 문자열로 포맷.
 * 예: [{MON,09:00,10:30},{WED,09:00,10:30}] → "월 09:00-10:30, 수 09:00-10:30"
 * 빈 배열이면 "시간 미정".
 */
export function formatSchedules(schedules: CourseScheduleSummary[]): string {
  if (schedules.length === 0) return '시간 미정'
  return schedules
    .map((s) => {
      const day = DAY_KO[s.day_of_week] ?? s.day_of_week
      const start = s.start_time.slice(0, 5)
      const end = s.end_time.slice(0, 5)
      return `${day} ${start}-${end}`
    })
    .join(', ')
}

/**
 * 추천 결과 페이지 부제용 — 등록 과목명 리스트를 한 줄로.
 *
 * - 0개 → "등록된 과목이 없어요"
 * - 1~5개 → "수강 과목 : A, B 기준 추천 결과입니다."
 * - 6개+ → "수강 과목 : A, B, C, D, E 외 N개 기준 추천 결과입니다."
 */
export function formatCoursesSummary(courseNames: string[]): string {
  if (courseNames.length === 0) return '등록된 과목이 없어요'
  if (courseNames.length <= 5) {
    return `수강 과목 : ${courseNames.join(', ')} 기준 추천 결과입니다.`
  }
  const head = courseNames.slice(0, 5).join(', ')
  const rest = courseNames.length - 5
  return `수강 과목 : ${head} 외 ${rest}개 기준 추천 결과입니다.`
}

/**
 * course_recommendations.reason_template 의 {course_name} 치환.
 *
 * - template === null 이면 fallback 메시지로 대체
 * - 호출 측에서 matched_course_names[0] ?? '' 로 안전한 과목명 전달 책임
 */
export function formatRecommendationReason(
  template: string | null,
  courseName: string,
): string {
  if (template === null) {
    return `${courseName} 수강생들이 함께 찾는 물품이에요`
  }
  return template.replaceAll('{course_name}', courseName)
}
