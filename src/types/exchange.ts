import { type Database } from './supabase'

// ──────────────────────────────────────────────────────────────────────────────
// DB Row 타입 별칭 (supabase.ts 기반)
// ──────────────────────────────────────────────────────────────────────────────

export type ExchangeStudentRow =
  Database['public']['Tables']['exchange_students']['Row']
export type CountryRow = Database['public']['Tables']['countries']['Row']
export type ExchangeWishlistRow =
  Database['public']['Tables']['exchange_wishlists']['Row']

// ──────────────────────────────────────────────────────────────────────────────
// ENUM 타입
// ──────────────────────────────────────────────────────────────────────────────

export type HousingType = 'dorm' | 'flat'
export type ExchangeRole = 'incoming' | 'outgoing'
export type LanguagePref = 'ko' | 'en'

// ──────────────────────────────────────────────────────────────────────────────
// 교환학생 프로필
// ──────────────────────────────────────────────────────────────────────────────

export interface ExchangeStudent {
  uid: string
  country_id: number | null
  region_group: string | null
  housing_type: HousingType | null
  semester: string | null
  language_pref: LanguagePref
  role: ExchangeRole | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

/** 국가 정보를 JOIN한 교환학생 프로필 (API 응답용) */
export interface ExchangeStudentWithCountry extends ExchangeStudent {
  country: Pick<Country, 'country_code' | 'name_ko' | 'name_en'> | null
}

// ──────────────────────────────────────────────────────────────────────────────
// 국가
// ──────────────────────────────────────────────────────────────────────────────

export interface Country {
  country_id: number
  country_code: string
  name_ko: string
  name_en: string
  region_group: string
}

// ──────────────────────────────────────────────────────────────────────────────
// 알림 신청 (Wishlist)
// ──────────────────────────────────────────────────────────────────────────────

export interface ExchangeWishlist {
  exchange_wishlist_id: number
  uid: string
  category_id: number
  region_group: string
  semester: string
  is_notified: boolean
  notified_at: string | null
  deleted_at: string | null
  created_at: string
}

/** 카테고리명을 JOIN한 알림 신청 (목록 조회용) */
export interface ExchangeWishlistWithCategory extends ExchangeWishlist {
  category_name: string
}

// ──────────────────────────────────────────────────────────────────────────────
// 온보딩 입력값
// ──────────────────────────────────────────────────────────────────────────────

export interface OnboardingInput {
  country_id: number
  region_group: string
  housing_type: HousingType
  semester: string
  language_pref: LanguagePref
  role: ExchangeRole
}

// ──────────────────────────────────────────────────────────────────────────────
// API 공통 응답 타입
// ──────────────────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string
  message: string
}

export interface ApiResponse<T> {
  data: T | null
  error: ApiError | null
}
