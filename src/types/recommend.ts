export type ProductCondition = 'high' | 'medium' | 'low'
export type HousingType = 'dorm' | 'flat'

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  high: '상',
  medium: '중',
  low: '하',
}

export const HOUSING_TYPE_LABELS: Record<HousingType, string> = {
  dorm: '기숙사',
  flat: '자취 / 하숙',
}

// ─── 패키지 추천 ───────────────────────────────────────────────

export interface PackageTemplate {
  package_template_id: number
  title: string
  description: string | null
  major_id: number | null
  grade: number | null
  housing_type: HousingType | null
  semester: string | null
}

export interface PackageTemplateItem {
  package_template_item_id: number
  package_template_id: number
  category_id: number
  required_quantity: number
  priority_order: number
}

export interface ProductSummary {
  pid: string
  title: string
  price: number
  condition: ProductCondition
  image_url: string | null
}

export interface CategoryWithProducts {
  category_id: number
  category_name: string
  required_quantity: number
  priority_order: number
  products: ProductSummary[]
}

// ─── 재판매 가격 추천 ───────────────────────────────────────────

export interface ResalePriceInput {
  category_id: number
  condition: ProductCondition
  usage_months: number
  purchase_price?: number
}

export interface ResalePriceRule {
  rule_id: number
  depreciation_rate: number
  min_price_ratio: number
  max_price_ratio: number
}

export interface ResalePriceResult {
  reference_price: number
  transaction_count: number
  recommended_price: number
  min_price: number
  max_price: number
  depreciation_rate: number
  purchase_price?: number
  market_avg_price?: number
}
