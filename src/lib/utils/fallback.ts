import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database } from '@/types/supabase'
import { type EssentialPackage, type PackageFallbackResult } from '@/types/package'

/**
 * 패키지 추천 Fallback 조회
 *
 * 3단계 Fallback 순서 (recommendation.md 기준):
 *   1순위: country_code + housing_type 정확 매칭
 *   2순위: region_group + housing_type 매칭
 *   3순위: region_group IS NULL AND housing_type IS NULL (범용 패키지)
 *
 * housing_type 처리:
 *   - housing_type이 일치하거나 IS NULL인 패키지 모두 포함
 *   - NULL 패키지 = 모든 거주형태에 적용 가능한 범용 패키지
 */
export const getPackageWithFallback = async (
  supabase: SupabaseClient<Database>,
  countryCode: string,
  regionGroup: string,
  housingType: 'dorm' | 'flat'
): Promise<PackageFallbackResult> => {
  // ── 1순위: country_code + housing_type 정확 매칭 ──────────────────────────
  const { data: tier1, error: err1 } = await supabase
    .from('essential_packages')
    .select('*')
    .eq('country_code', countryCode)
    .or(`housing_type.eq.${housingType},housing_type.is.null`)
    .order('package_id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (err1) {
    console.error('[fallback] 1순위 조회 실패:', err1)
  }

  if (tier1) {
    return { data: tier1 as EssentialPackage, tier: 1, label: null }
  }

  // ── 2순위: region_group + housing_type 매칭 ───────────────────────────────
  const { data: tier2, error: err2 } = await supabase
    .from('essential_packages')
    .select('*')
    .eq('region_group', regionGroup)
    .or(`housing_type.eq.${housingType},housing_type.is.null`)
    .order('package_id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (err2) {
    console.error('[fallback] 2순위 조회 실패:', err2)
  }

  if (tier2) {
    return {
      data: tier2 as EssentialPackage,
      tier: 2,
      label: `${regionGroup} 지역 기준`,
    }
  }

  // ── 3순위: 범용 패키지 (region_group IS NULL, housing_type IS NULL) ────────
  const { data: tier3, error: err3 } = await supabase
    .from('essential_packages')
    .select('*')
    .is('region_group', null)
    .is('housing_type', null)
    .order('package_id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (err3) {
    console.error('[fallback] 3순위 조회 실패:', err3)
  }

  if (tier3) {
    return {
      data: tier3 as EssentialPackage,
      tier: 3,
      label: '전체 범용 패키지',
    }
  }

  // ── 결과 없음 ──────────────────────────────────────────────────────────────
  return { data: null, tier: 0, label: null }
}

// ──────────────────────────────────────────────────────────────────────────────
// Fallback 안내 텍스트 (UI 표시용)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fallback 적용 시 UI에 표시할 안내 문구 반환
 *
 * @param tier       적용된 Fallback 순위
 * @param label      getPackageWithFallback이 반환한 label
 * @param regionName 사용자 언어에 맞는 지역명 (예: "독일")
 */
export const getFallbackMessage = (
  tier: 0 | 1 | 2 | 3,
  label: string | null,
  regionName?: string
): string | null => {
  switch (tier) {
    case 1:
      return null
    case 2:
      return `정확히 일치하는 패키지가 없어 ${regionName ?? label} 기준으로 추천드려요`
    case 3:
      return '해당 지역 패키지가 없어 전체 범용 패키지를 추천드려요'
    case 0:
      return '현재 조건에 맞는 패키지가 없어요'
    default:
      return null
  }
}
