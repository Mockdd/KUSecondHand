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

/**
 * 상품 카테고리 1건의 최소 표현.
 *
 * - getCategoryById 반환 / ProductDetail.category 양쪽에서 공유
 * - parent 계층은 화면 3/4 에서 사용 안 하므로 미포함
 */
export interface CategorySummary {
  category_id: number
  name: string
}

/**
 * 매물 목록(화면 3) 정렬 옵션.
 * - recommended: view_count DESC, created_at DESC (인기 매물 상단)
 * - price_asc:   price ASC, created_at DESC
 * - latest:      created_at DESC
 */
export type ProductSort = 'recommended' | 'price_asc' | 'latest'

/**
 * 매물 목록 카드 1건 — 화면 3 그리드 렌더링용.
 *
 * status 'sold' 매물은 listProductsByCategory 에서 제외하지만,
 * 'reserved' 는 노출하므로 타입에는 세 값 모두 유지.
 * thumbnail_url 은 product_images.display_order 최소 행의 image_url. 이미지 없으면 null.
 */
export interface ProductListItem {
  pid: string
  title: string
  price: number
  status: 'selling' | 'reserved' | 'sold'
  // DB enum: product_condition_t (high | medium | low).
  condition: 'high' | 'medium' | 'low'
  view_count: number
  created_at: string
  thumbnail_url: string | null
}

/**
 * 도서 매물 상세 상태 — book_conditions 1:0..1.
 * 도서 매물이 아니거나 등록 안 된 경우 ProductDetail.book_condition = null.
 */
export interface BookConditionData {
  // DB enum: book_mark_t.
  underline_mark: 'none' | 'pencil' | 'pen'
  handwriting:    'none' | 'pencil' | 'pen'
  // BOOLEAN: TRUE = 깨끗함
  cover_state:    boolean
  // BOOLEAN: TRUE = 이름 기재됨
  name_written:   boolean
  // BOOLEAN: TRUE = 변색 있음
  discoloration:  boolean
  // BOOLEAN: TRUE = 페이지 손상 있음
  page_damage:    boolean
}

/**
 * 기기 매물 상세 상태 — device_conditions 1:0..1.
 * 기기 매물이 아니거나 등록 안 된 경우 ProductDetail.device_condition = null.
 */
export interface DeviceConditionData {
  // DB enum: grade_hml_t.
  usage_wear:       'high' | 'mid' | 'low'
  cleanliness:      'high' | 'mid' | 'low'
  // DB enum: device_op_t.
  operation_status: 'normal' | 'partial_issue'
  // DB enum: included_t.
  battery_included: 'included' | 'not_included'
  // DB enum: accessories_t.
  accessories:      'body_only' | 'case_included' | 'manual_included'
}

/**
 * 매물 상세 화면(화면 4) 표시용 통합 타입.
 *
 * products 1건 + product_images 전체 + book_conditions/device_conditions(둘 중 하나)
 * + seller(users) + category 를 한 번에 조회한 결과.
 * book_condition 과 device_condition 은 동시에 채워지지 않음 (양쪽 모두 null 인 매물은 ETC 카테고리 가능).
 */
export interface ProductDetail {
  pid: string
  title: string
  price: number
  description: string | null
  status: 'selling' | 'reserved' | 'sold'
  condition: 'high' | 'medium' | 'low'
  view_count: number
  created_at: string
  category: CategorySummary
  images: { image_url: string; display_order: number }[]
  seller: {
    uid: string
    nickname: string
    profile_image_url: string | null
    manner_temperature: number
    trade_count: number
  }
  book_condition: BookConditionData | null
  device_condition: DeviceConditionData | null
}
