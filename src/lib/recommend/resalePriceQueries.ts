import { SupabaseClient } from '@supabase/supabase-js'
import { ProductCondition, ResalePriceRule } from '@/types/recommend'

export async function fetchMatchingPriceRule(
  supabase: SupabaseClient,
  params: {
    category_id: number
    condition: ProductCondition
    usage_months: number
  }
): Promise<ResalePriceRule | null> {
  const { data, error } = await supabase
    .from('resale_price_rules')
    .select('rule_id, depreciation_rate, min_price_ratio, max_price_ratio')
    .or(`category_id.eq.${params.category_id},category_id.is.null`)
    .or(`condition.eq.${params.condition},condition.is.null`)
    .lte('usage_months_min', params.usage_months)
    .or(`usage_months_max.is.null,usage_months_max.gte.${params.usage_months}`)
    .order('category_id', { ascending: false, nullsFirst: false })
    .order('condition', { ascending: false, nullsFirst: false })
    .limit(1)

  if (error || !data || data.length === 0) return null
  return data[0]
}

// Route Handler를 통해 service_role로 transactions 집계
export async function fetchCategoryAvgPrice(
  categoryId: number
): Promise<{ avg_price: number | null; count: number }> {
  const res = await fetch(
    `/api/recommend/category-avg-price?category_id=${categoryId}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return { avg_price: null, count: 0 }
  return res.json() as Promise<{ avg_price: number | null; count: number }>
}

export async function fetchCategories(
  supabase: SupabaseClient
): Promise<{ category_id: number; name: string }[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('category_id, name')
    .order('name')

  if (error || !data) return []
  return data
}
