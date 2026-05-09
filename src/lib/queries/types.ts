/**
 * lib/queries/* 에서 공유하는 데이터 액세스 레이어 공통 타입.
 *
 * database.types.ts 생성 전까지의 임시 정의.
 * 이후 자동 생성된 Database 타입으로 교체/보강 예정.
 */

/**
 * 단과대학 그룹 내에서 사용하는 전공 옵션.
 * (college 는 그룹 키로 사용되므로 값에서는 생략)
 */
export interface MajorOption {
  major_id: number
  name: string
}

/**
 * 과목 시간표 1개. courses 와 LEFT JOIN 되어 0~N개 들어옴.
 */
export interface CourseScheduleSummary {
  // DB enum: day_of_week_t. database.types.ts 도입 시 union literal 로 좁아짐.
  day_of_week: string
  start_time: string
  end_time: string
}

/**
 * 시간표 추천 페이지의 과목 검색 결과 단위.
 */
export interface CourseSearchResult {
  course_id: number
  course_code: string
  name: string
  professor: string | null
  credit: number | null
  grade_level: number | null
  // DB enum: course_category_t.
  category_type: string
  major_id: number | null
  liberal_area: string | null
  schedules: CourseScheduleSummary[]
}

/**
 * 내가 등록한 수강 과목 1건.
 *
 * CourseSearchResult 의 모든 필드 + user_courses 에서 가져온 메타데이터.
 * - enrolled_at: user_courses.created_at (등록 시각)
 * - semester: '2026-1' 형식. 단일 학기 조회여도 향후 다학기 그룹화 대비 포함.
 */
export interface MyCourseEntry extends CourseSearchResult {
  enrolled_at: string
  semester: string
}

/**
 * 추천 결과 페이지에서 사용하는 카테고리 1건.
 *
 * course_recommendations 의 (course, item_category) 페어를
 * item_category_id 기준으로 그룹화한 결과.
 * - matched_course_ids/names: 이 카테고리를 매칭시킨 사용자 과목들
 * - priority: 그룹 내 최댓값 (가장 강한 추천 신호)
 * - reason_template: 그룹 내 가장 높은 priority 행의 것
 * - category_id: 매물 목록 페이지로 이동할 상품 카테고리 ID. NULL 이면 미매핑.
 */
export interface RecommendationGroup {
  item_category_id: number
  item_category_name: string
  // DB enum: item_category_type_t (BOOK | DEVICE | ETC).
  item_category_type: string
  item_category_description: string | null
  category_id: number | null
  matched_course_ids: number[]
  matched_course_names: string[]
  reason_template: string | null
  priority: number
}
