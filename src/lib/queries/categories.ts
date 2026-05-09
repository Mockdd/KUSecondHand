import { createClient } from '@lib/supabase/client'
import type { CategorySummary } from './types'

/**
 * 카테고리 1건을 ID 로 조회한다 (화면 3 헤딩의 카테고리명 표시용).
 *
 * - 존재하지 않으면 null (호출 측에서 "카테고리를 찾을 수 없어요" 처리)
 * - parent_id 등 계층 정보는 화면 3/4 에서 미사용이라 SELECT 제외
 * - RLS: categories 는 전체 공개 SELECT
 */
export async function getCategoryById(
  categoryId: number,
): Promise<CategorySummary | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('categories')
    .select('category_id, name')
    .eq('category_id', categoryId)
    .maybeSingle()

  if (error) {
    throw new Error(`[categories.getCategoryById] ${error.message}`)
  }

  if (!data) return null

  return data as CategorySummary
}
