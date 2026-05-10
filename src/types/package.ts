import { type Database } from './supabase'

// ──────────────────────────────────────────────────────────────────────────────
// DB Row 타입 별칭
// ──────────────────────────────────────────────────────────────────────────────

export type EssentialPackageRow =
  Database['public']['Tables']['essential_packages']['Row']
export type PackageItemRow =
  Database['public']['Tables']['package_items']['Row']
export type PackageListingRow =
  Database['public']['Tables']['package_listings']['Row']
export type CategoryRow = Database['public']['Tables']['categories']['Row']

// ──────────────────────────────────────────────────────────────────────────────
// ENUM 타입
// ──────────────────────────────────────────────────────────────────────────────

export type TemplateType = 'DORM_BASIC' | 'FLAT_FULL' | 'INCOMING_DORM'
export type ListingStatus = 'selling' | 'reserved' | 'sold'
export type CertStatus = 'pending' | 'approved' | 'rejected'

// ──────────────────────────────────────────────────────────────────────────────
// 패키지 템플릿
// ──────────────────────────────────────────────────────────────────────────────

export interface EssentialPackage {
  package_id: number
  template_type: TemplateType
  name_ko: string
  name_en: string
  country_code: string | null
  region_group: string | null
  housing_type: 'dorm' | 'flat' | null
  created_at: string
}

// ──────────────────────────────────────────────────────────────────────────────
// 패키지 구성 물품
// ──────────────────────────────────────────────────────────────────────────────

export interface PackageItem {
  package_item_id: number
  package_id: number
  category_id: number
  is_required: boolean
  priority_order: number
  requires_hygiene_cert: boolean
}

/** 카테고리명을 JOIN한 패키지 물품 (화면 표시용) */
export interface PackageItemWithCategory extends PackageItem {
  category_name: string
}

/** 패키지 상세 화면용 — 셀러 보유 여부, 인증 상태 포함 */
export interface PackageItemDetail extends PackageItemWithCategory {
  is_owned: boolean
  hygiene_cert_status: CertStatus | null
  /** 미보유 물품의 일반 매물 (보완 시스템) */
  supplement_products?: SupplementProduct[]
}

// ──────────────────────────────────────────────────────────────────────────────
// 패키지 매물 (셀러가 등록한 보유 물품)
// ──────────────────────────────────────────────────────────────────────────────

export interface PackageListing {
  listing_id: number
  match_id: number
  seller_uid: string
  category_id: number
  status: ListingStatus
  semester: string
  cert_id: number | null
  image_url: string | null
  created_at: string
  updated_at: string
}

// ──────────────────────────────────────────────────────────────────────────────
// 셀러 점수 (패키지 추천 목록용)
// ──────────────────────────────────────────────────────────────────────────────

export interface SellerWithScore {
  match_id: number
  seller_uid: string
  seller_name: string
  semester: string
  /** 다른 학기 셀러인지 여부 — true면 UI에 "다른 학기" 배지 표시 */
  is_different_semester: boolean
  owned_count: number
  total_count: number
  ownership_rate: number
  hygiene_cert_rate: number
  /** 최종 점수 = 보유율 * 0.7 + 세탁인증 비율 * 0.3 */
  score: number
  /** 이미 바이어가 이 셀러에게 요청한 매칭이 있는지 */
  already_requested: boolean
  /** already_requested=true 일 때 연결된 채팅방 ID */
  room_id: number | null
}

// ──────────────────────────────────────────────────────────────────────────────
// 패키지 추천 Fallback 결과
// ──────────────────────────────────────────────────────────────────────────────

export interface PackageFallbackResult {
  data: EssentialPackage | null
  /** 적용된 Fallback 순위 (1: 정확 매칭, 2: 지역 매칭, 3: 범용, 0: 결과 없음) */
  tier: 0 | 1 | 2 | 3
  /** Fallback 적용 시 UI에 표시할 안내 문구 (1순위면 null) */
  label: string | null
}

// ──────────────────────────────────────────────────────────────────────────────
// 보완 시스템 — 일반 매물
// ──────────────────────────────────────────────────────────────────────────────

export interface SupplementProduct {
  pid: string
  title: string
  price: number
  condition: string
  seller_name: string
  thumbnail: string | null
}
