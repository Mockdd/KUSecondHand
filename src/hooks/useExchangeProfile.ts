'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { type ExchangeStudentWithCountry } from '@/types/exchange'

/**
 * 교환학생 프로필 조회 훅
 *
 * - TanStack Query v5로 프로필 캐싱 (queryKey: ['exchange-profile'])
 * - 미로그인 시 null 반환 (리다이렉트 없음 — 개발 중 인증 우회 목적)
 * - 프로필 없음(PGRST116) 시 null 반환
 * - 교환학생 전용 페이지 진입 시 공통으로 사용
 *
 * 사용 예시:
 *   const { profile, isLoading, error } = useExchangeProfile()
 *   if (isLoading) return <Spinner />
 *   if (error) return <ErrorMessage />
 */

interface UseExchangeProfileResult {
  profile: ExchangeStudentWithCountry | null
  isLoading: boolean
  /** 프로필 조회 중 발생한 에러 메시지 */
  error: string | null
}

export const useExchangeProfile = (): UseExchangeProfileResult => {
  const supabase = createClient()

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['exchange-profile'],
    queryFn: async (): Promise<ExchangeStudentWithCountry | null> => {
      // ── 1. 로그인 세션 확인 ──────────────────────────────────────────────
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      // 미로그인 시 null 반환 (리다이렉트 없음)
      if (authError || !user) return null

      // ── 2. 교환학생 프로필 조회 ──────────────────────────────────────────
      const { data: profile, error: profileError } = await supabase
        .from('exchange_students')
        .select(`
          uid,
          country_id,
          region_group,
          housing_type,
          semester,
          language_pref,
          role,
          onboarding_completed,
          created_at,
          updated_at,
          countries (
            country_code,
            name_ko,
            name_en
          )
        `)
        .eq('uid', user.id)
        .single()

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // 프로필 없음 — null 반환 (홈에서 DB 삽입 안내 표시)
          return null
        }
        console.error('[useExchangeProfile] 프로필 조회 실패:', profileError)
        throw new Error('INTERNAL_ERROR')
      }

      // countries는 Supabase join 결과로 배열 또는 객체가 올 수 있음
      const country = Array.isArray(profile.countries)
        ? (profile.countries[0] ?? null)
        : (profile.countries ?? null)

      return {
        ...profile,
        country,
      } as ExchangeStudentWithCountry
    },
    // 탭 포커스 시 자동 재조회 (세션 만료 감지)
    refetchOnWindowFocus: true,
    // 5분 동안 캐시 유지
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  // ── 반환값 정규화 ─────────────────────────────────────────────────────────
  const errorMessage = queryError
    ? '프로필을 불러오는 중 오류가 발생했어요. 다시 시도해주세요.'
    : null

  return {
    profile: data ?? null,
    isLoading,
    error: errorMessage,
  }
}
