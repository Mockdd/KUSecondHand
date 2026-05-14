import { createClient } from '@lib/supabase/client'
import type {
  BookConditionData,
  DeviceConditionData,
  ProductDetail,
  ProductListItem,
  ProductSort,
} from './types'

const LIST_SELECT = `
  pid,
  title,
  price,
  status,
  condition,
  view_count,
  created_at,
  product_images (
    image_url,
    display_order
  )
`

interface ListRow {
  pid: string
  title: string
  price: number
  status: 'selling' | 'reserved' | 'sold'
  condition: 'high' | 'medium' | 'low'
  view_count: number
  created_at: string
  product_images: { image_url: string; display_order: number }[] | null
}

const DEFAULT_LIST_LIMIT = 30

function pickThumbnailUrl(
  images: ListRow['product_images'],
): string | null {
  if (!images || images.length === 0) return null
  const sorted = [...images].sort((a, b) => a.display_order - b.display_order)
  return sorted[0].image_url
}

/**
 * 특정 카테고리의 매물 목록을 조회한다 (화면 3).
 *
 * - deleted_at IS NULL + status != 'sold' 필터 (sold 는 화면 3 미노출)
 * - includeChildren=true 면 categories.parent_id = categoryId 자식 1단계까지 IN 절 확장
 *   (손자 이상은 미지원 — 현재 시드가 단층 가정. 필요해지면 RPC 로 분리)
 * - 정렬은 ProductSort 분기:
 *   recommended → view_count DESC, created_at DESC
 *   price_asc   → price ASC, created_at DESC
 *   latest      → created_at DESC
 * - 썸네일은 product_images 중 display_order 최소 행의 image_url
 * - cursor 미지원 (MVP). 추후 무한 스크롤 도입 시 정렬별 keyset 별도 설계.
 */
export async function listProductsByCategory(params: {
  categoryId: number
  sort: ProductSort
  includeChildren?: boolean
  limit?: number
}): Promise<ProductListItem[]> {
  const {
    categoryId,
    sort,
    includeChildren = false,
    limit = DEFAULT_LIST_LIMIT,
  } = params

  const supabase = createClient()

  let categoryIds: number[] = [categoryId]

  if (includeChildren) {
    const { data: childRows, error: childError } = await supabase
      .from('categories')
      .select('category_id')
      .eq('parent_id', categoryId)

    if (childError) {
      throw new Error(
        `[products.listProductsByCategory] categories: ${childError.message}`,
      )
    }

    const childIds = (
      (childRows ?? []) as unknown as { category_id: number }[]
    ).map((r) => r.category_id)
    categoryIds = [categoryId, ...childIds]
  }

  let query = supabase
    .from('products')
    .select(LIST_SELECT)
    .is('deleted_at', null)
    .neq('status', 'sold')
    .in('category_id', categoryIds)

  if (sort === 'recommended') {
    query = query
      .order('view_count', { ascending: false })
      .order('created_at', { ascending: false })
  } else if (sort === 'price_asc') {
    query = query
      .order('price', { ascending: true })
      .order('created_at', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query.limit(limit)

  if (error) {
    throw new Error(`[products.listProductsByCategory] ${error.message}`)
  }

  const rows = (data ?? []) as unknown as ListRow[]

  return rows.map((r) => ({
    pid: r.pid,
    title: r.title,
    price: r.price,
    status: r.status,
    condition: r.condition,
    view_count: r.view_count,
    created_at: r.created_at,
    thumbnail_url: pickThumbnailUrl(r.product_images),
  }))
}

const DETAIL_SELECT = `
  pid,
  title,
  price,
  description,
  status,
  condition,
  view_count,
  created_at,
  category:categories!category_id (
    category_id,
    name
  ),
  seller:users!seller_uid (
    uid,
    nickname,
    profile_image_url,
    manner_temperature,
    trade_count
  ),
  product_images (
    image_url,
    display_order
  ),
  book_conditions (
    underline_mark,
    handwriting,
    cover_state,
    name_written,
    discoloration,
    page_damage
  ),
  device_conditions (
    usage_wear,
    cleanliness,
    operation_status,
    battery_included,
    accessories
  )
`

type EmbeddedOne<T> = T | T[] | null

interface DetailRow {
  pid: string
  title: string
  price: number
  description: string | null
  status: 'selling' | 'reserved' | 'sold'
  condition: 'high' | 'medium' | 'low'
  view_count: number
  created_at: string
  category: EmbeddedOne<{ category_id: number; name: string }>
  seller: EmbeddedOne<{
    uid: string
    nickname: string
    profile_image_url: string | null
    manner_temperature: number
    trade_count: number
  }>
  product_images: { image_url: string; display_order: number }[] | null
  book_conditions: EmbeddedOne<BookConditionData>
  device_conditions: EmbeddedOne<DeviceConditionData>
}

function pickOne<T>(value: EmbeddedOne<T>): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * 매물 상세 1건을 조회한다 (화면 4).
 *
 * - deleted_at IS NULL 필터 (RLS 와 중복이지만 명시)
 * - product_images, book_conditions, device_conditions, category, seller 한 번에 join
 * - book_conditions / device_conditions 는 1:0..1 — Supabase 가 객체 또는 배열로 반환할 수 있어
 *   pickOne 으로 통일해서 BookConditionData | null, DeviceConditionData | null 로 정규화
 * - 매물이 없거나 soft-delete 면 null
 * - view_count 는 직접 UPDATE 하지 않음 — 호출 측에서 logProductView(pid) 별도 호출
 */
export async function getProductDetail(
  pid: string,
): Promise<ProductDetail | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('products')
    .select(DETAIL_SELECT)
    .eq('pid', pid)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new Error(`[products.getProductDetail] ${error.message}`)
  }

  if (!data) return null

  const row = data as unknown as DetailRow

  const category = pickOne(row.category)
  const seller = pickOne(row.seller)

  if (!category || !seller) {
    // FK NOT NULL 이라 정상 데이터에서는 발생하지 않음. 데이터 무결성 문제 가시화.
    throw new Error(
      `[products.getProductDetail] category 또는 seller join 결과 없음 pid=${pid}`,
    )
  }

  const images = (row.product_images ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)

  return {
    pid: row.pid,
    title: row.title,
    price: row.price,
    description: row.description,
    status: row.status,
    condition: row.condition,
    view_count: row.view_count,
    created_at: row.created_at,
    category,
    seller,
    images,
    book_condition: pickOne(row.book_conditions),
    device_condition: pickOne(row.device_conditions),
  }
}

/**
 * 매물 조회 이벤트를 product_view_logs 에 INSERT (화면 4 진입 시 1회).
 *
 * - viewer_uid 는 현재 인증 사용자(있으면), 비로그인이면 NULL
 * - products.view_count 는 직접 UPDATE 금지 — pg_cron 배치에 위임 (스키마 주석 참조)
 * - fire-and-forget 패턴: 실패해도 throw 하지 않고 console.warn 만 찍음.
 *   화면 렌더가 로깅 실패로 깨지면 본말전도이므로 호출 측에서 await 없이 무시 가능.
 */
export async function logProductView(pid: string): Promise<void> {
  const supabase = createClient()

  let viewerUid: string | null = null
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    viewerUid = user?.id ?? null
  } catch {
    // auth 조회 실패는 비로그인으로 간주
  }

  const { error } = await supabase
    .from('product_view_logs')
    .insert({ pid, viewer_uid: viewerUid })

  if (error) {
    console.warn(`[products.logProductView] ${error.message}`)
  }
}
