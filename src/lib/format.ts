/**
 * 표현 계층 변환 헬퍼.
 *
 * lib/queries/* 가 DB 통신만 책임진다면, 여기서는 그 결과를
 * 화면 텍스트로 옮기는 KO 매핑과 포맷터를 모은다.
 */

import type {
  BookConditionData,
  CourseScheduleSummary,
  DeviceConditionData,
} from './queries/types'

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

const PRICE_FORMATTER = new Intl.NumberFormat('ko-KR')

/**
 * 매물 가격 포맷터 — 화면 3/4 카드 및 상세에서 공통 사용.
 *
 * 예: 15000 → "15,000원"
 * 음수/소수는 DB CHECK (price >= 0) 가 보장하므로 별도 방어 안 함.
 */
export function formatPrice(price: number): string {
  return `${PRICE_FORMATTER.format(price)}원`
}

// ─── 화면 4 (상품 상세) 책/기기 상태 매핑 ────────────────────────────
//
// 라이브 DB 의 ENUM 값(book_mark_t / book_cover_t / yes_no_t / grade_hml_t /
// device_op_t / included_t / accessories_t) 을 화면 표시 한글로 매핑한다.
// 옆 팀의 BOOLEAN 마이그레이션이 적용되면 yes_no_t / book_cover_t 두 매핑은
// 제거되고 BOOLEAN 분기로 교체될 예정 (CLAUDE.md '알려진 schema-DB drift' 참조).

/** DB enum: book_mark_t — 밑줄/필기 흔적 */
export const BOOK_MARK_KO: Record<BookConditionData['underline_mark'], string> = {
  none: '없음',
  pencil: '연필/샤프',
  pen_highlighter: '볼펜/형광펜',
}

/** DB enum: book_cover_t — 겉표지 */
export const BOOK_COVER_KO: Record<BookConditionData['cover_state'], string> = {
  clean: '깨끗함',
  not_clean: '깨끗하지 않음',
}

/** DB enum: yes_no_t — 이름 기입/변색/훼손 공통 */
export const YES_NO_KO: Record<BookConditionData['name_written'], string> = {
  yes: '있음',
  no: '없음',
}

/** DB enum: grade_hml_t — 사용감/청결도 */
export const GRADE_HML_KO: Record<DeviceConditionData['usage_wear'], string> = {
  high: '상',
  mid: '중',
  low: '하',
}

/** DB enum: device_op_t — 작동 여부 */
export const DEVICE_OP_KO: Record<DeviceConditionData['operation_status'], string> = {
  normal: '정상 작동',
  partial_issue: '일부 문제 있음',
}

/** DB enum: included_t — 배터리 포함 여부 */
export const INCLUDED_KO: Record<DeviceConditionData['battery_included'], string> = {
  included: '포함',
  not_included: '미포함',
}

/** DB enum: accessories_t — 구성품 */
export const ACCESSORIES_KO: Record<DeviceConditionData['accessories'], string> = {
  body_only: '본체만',
  case_included: '케이스 포함',
  manual_included: '설명서 포함',
}

/**
 * 화면 4 책/기기 상태 한 행을 그릴 때 필요한 메타데이터.
 *
 * options 는 표시 순서 배열, map 은 그 옵션의 한글 라벨.
 * key 와 options 원소 타입을 매핑 분포(distributive)로 묶어 type-safe.
 */
export type BookFieldDef = {
  [K in keyof BookConditionData]: {
    key: K
    label: string
    options: BookConditionData[K][]
    map: Record<BookConditionData[K], string>
  }
}[keyof BookConditionData]

export type DeviceFieldDef = {
  [K in keyof DeviceConditionData]: {
    key: K
    label: string
    options: DeviceConditionData[K][]
    map: Record<DeviceConditionData[K], string>
  }
}[keyof DeviceConditionData]

/** 화면 4 책 상태 6항목 — 표시 순서 고정 (목업 기준) */
export const BOOK_FIELDS: BookFieldDef[] = [
  { key: 'underline_mark', label: '밑줄 흔적',  options: ['none', 'pencil', 'pen_highlighter'], map: BOOK_MARK_KO },
  { key: 'handwriting',    label: '필기 흔적',  options: ['none', 'pencil', 'pen_highlighter'], map: BOOK_MARK_KO },
  { key: 'cover_state',    label: '겉표지',     options: ['clean', 'not_clean'],                 map: BOOK_COVER_KO },
  { key: 'name_written',   label: '이름 기입',  options: ['no', 'yes'],                          map: YES_NO_KO },
  { key: 'discoloration',  label: '페이지 변색', options: ['yes', 'no'],                         map: YES_NO_KO },
  { key: 'page_damage',    label: '페이지 훼손', options: ['yes', 'no'],                         map: YES_NO_KO },
]

/** 화면 4 기기 상태 5항목 — 표시 순서 고정 (목업 기준) */
export const DEVICE_FIELDS: DeviceFieldDef[] = [
  { key: 'usage_wear',       label: '사용감',     options: ['high', 'mid', 'low'],                                map: GRADE_HML_KO },
  { key: 'cleanliness',      label: '청결도',     options: ['high', 'mid', 'low'],                                map: GRADE_HML_KO },
  { key: 'operation_status', label: '작동 여부',  options: ['normal', 'partial_issue'],                           map: DEVICE_OP_KO },
  { key: 'battery_included', label: '배터리 포함', options: ['included', 'not_included'],                          map: INCLUDED_KO },
  { key: 'accessories',      label: '구성품',     options: ['body_only', 'case_included', 'manual_included'],    map: ACCESSORIES_KO },
]
