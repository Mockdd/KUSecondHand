import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database } from '@/types/supabase'
import { createEmbedding } from '@/lib/openai/embeddings'

const RRF_K = 60

export interface ProductSearchResult {
  pid: string
  title: string
  price: number
  condition: string
  category_id: number
  seller_uid: string
  seller_nickname: string
  thumbnail: string | null
  rrf_score: number
}

export interface PackageSearchResult {
  package_id: number
  template_type: string
  name_ko: string
  name_en: string
  housing_type: string | null
  rrf_score: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>

// ──────────────────────────────────────────────────────────────────────────────
// 매물 Hybrid Search
// ──────────────────────────────────────────────────────────────────────────────

export async function searchProducts(
  supabase: SupabaseClient<Database>,
  query: string,
  limit = 20
): Promise<ProductSearchResult[]> {
  const embedding = await createEmbedding(query)
  const sb = supabase as AnySupabase

  const { data: semanticRows } = await sb.rpc('match_products_semantic', {
    query_embedding: `[${embedding.join(',')}]`,
    match_count: 50,
  })

  const { data: fuzzyRows } = await sb.rpc('match_products_fuzzy', {
    query_text: query,
    match_count: 50,
  })

  const scoreMap = new Map<string, number>()

  // similarity < 0.15 인 semantic 결과는 관련성 낮으므로 제외
  const SEMANTIC_THRESHOLD = 0.25
  ;((semanticRows ?? []) as { pid: string; similarity: number }[])
    .filter((row) => row.similarity >= SEMANTIC_THRESHOLD)
    .forEach((row, rank) => {
      scoreMap.set(row.pid, (scoreMap.get(row.pid) ?? 0) + 1 / (RRF_K + rank + 1))
    })
  ;((fuzzyRows ?? []) as { pid: string }[]).forEach((row, rank) => {
    scoreMap.set(row.pid, (scoreMap.get(row.pid) ?? 0) + 1 / (RRF_K + rank + 1))
  })

  const topPids = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([pid]) => pid)

  if (topPids.length === 0) return []

  const { data: products } = await sb
    .from('products')
    .select(`
      pid, title, price, condition, category_id, seller_uid,
      users!seller_uid (nickname),
      product_images (image_url, display_order)
    `)
    .in('pid', topPids)
    .is('deleted_at', null)
    .eq('status', 'selling')

  if (!products) return []

  const results: ProductSearchResult[] = []
  for (const pid of topPids) {
    const p = (products as { pid: string; title: string; price: number; condition: string; category_id: number; seller_uid: string; users: unknown; product_images: unknown }[]).find((r) => r.pid === pid)
    if (!p) continue

    const seller = Array.isArray(p.users) ? p.users[0] : p.users
    const images = (Array.isArray(p.product_images) ? p.product_images : []) as { image_url: string; display_order: number }[]
    const thumbnail = images.sort((a, b) => a.display_order - b.display_order)[0]?.image_url ?? null

    results.push({
      pid: p.pid,
      title: p.title,
      price: p.price,
      condition: p.condition,
      category_id: p.category_id,
      seller_uid: p.seller_uid,
      seller_nickname: (seller as { nickname: string } | null)?.nickname ?? '알 수 없음',
      thumbnail,
      rrf_score: scoreMap.get(pid) ?? 0,
    })
  }

  return results
}

// ──────────────────────────────────────────────────────────────────────────────
// 패키지 Hybrid Search
// ──────────────────────────────────────────────────────────────────────────────

export async function searchPackages(
  supabase: SupabaseClient<Database>,
  query: string,
  limit = 10
): Promise<PackageSearchResult[]> {
  const embedding = await createEmbedding(query)
  const sb = supabase as AnySupabase

  const { data: semanticRows } = await sb.rpc('match_packages_semantic', {
    query_embedding: `[${embedding.join(',')}]`,
    match_count: 20,
  })

  const { data: fuzzyRows } = await sb.rpc('match_packages_fuzzy', {
    query_text: query,
    match_count: 20,
  })

  const scoreMap = new Map<number, number>()

  const SEMANTIC_THRESHOLD = 0.25
  ;((semanticRows ?? []) as { package_id: number; similarity: number }[])
    .filter((row) => row.similarity >= SEMANTIC_THRESHOLD)
    .forEach((row, rank) => {
      scoreMap.set(row.package_id, (scoreMap.get(row.package_id) ?? 0) + 1 / (RRF_K + rank + 1))
    })
  ;((fuzzyRows ?? []) as { package_id: number }[]).forEach((row, rank) => {
    scoreMap.set(row.package_id, (scoreMap.get(row.package_id) ?? 0) + 1 / (RRF_K + rank + 1))
  })

  const topIds = [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)

  if (topIds.length === 0) return []

  const { data: packages } = await sb
    .from('essential_packages')
    .select('package_id, template_type, name_ko, name_en, housing_type')
    .in('package_id', topIds)

  if (!packages) return []

  const results: PackageSearchResult[] = []
  for (const id of topIds) {
    const p = (packages as { package_id: number; template_type: string; name_ko: string; name_en: string; housing_type: string | null }[]).find((r) => r.package_id === id)
    if (!p) continue
    results.push({
      package_id: p.package_id,
      template_type: p.template_type,
      name_ko: p.name_ko,
      name_en: p.name_en,
      housing_type: p.housing_type,
      rrf_score: scoreMap.get(id) ?? 0,
    })
  }

  return results
}
