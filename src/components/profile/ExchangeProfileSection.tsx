'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'
import type { HousingTypeEnum, LanguagePrefEnum, ExchangeRoleEnum } from '@/types/supabase'

// 국가 코드로 역할 자동 결정 (KR = incoming, 그 외 = outgoing)
function deriveRole(countryCode: string | undefined): ExchangeRoleEnum {
  return countryCode === 'KR' ? 'incoming' : 'outgoing'
}

type Country = { country_id: number; country_code: string; name_ko: string; name_en: string; region_group: string }

export function ExchangeProfileSection() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { profile, isLoading } = useExchangeProfile()

  const [countryId, setCountryId] = useState<number | ''>('')
  const [housingType, setHousingType] = useState<HousingTypeEnum | ''>('')
  const [semester, setSemester] = useState('')
  const [languagePref, setLanguagePref] = useState<LanguagePrefEnum>('ko')
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // 국가 목록
  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data } = await supabase.from('countries').select('*').order('name_ko')
      return data ?? []
    },
    staleTime: Infinity,
  })

  // 기존 프로필 있으면 초기값 설정
  useEffect(() => {
    if (profile) {
      setCountryId(profile.country_id ?? '')
      setHousingType(profile.housing_type ?? '')
      setSemester(profile.semester ?? '')
      setLanguagePref(profile.language_pref ?? 'ko')
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요해요')
      if (!countryId) throw new Error('국가를 선택해주세요')

      const selectedCountry = countries.find((c) => c.country_id === Number(countryId))
      const role = deriveRole(selectedCountry?.country_code)

      if (profile) {
        // 업데이트
        const { error } = await supabase
          .from('exchange_students')
          .update({
            country_id: Number(countryId),
            region_group: selectedCountry?.region_group ?? '',
            housing_type: housingType || null,
            semester: semester || null,
            language_pref: languagePref,
            role,
          })
          .eq('uid', user.id)
        if (error) throw error
      } else {
        // 신규 생성
        const { error } = await supabase
          .from('exchange_students')
          .insert({
            uid: user.id,
            country_id: Number(countryId),
            region_group: selectedCountry?.region_group ?? '',
            housing_type: housingType || null,
            semester: semester || null,
            language_pref: languagePref,
            role,
          })
        if (error) throw error
      }
    },
    onSuccess: () => {
      setSaveMsg(profile ? '저장됐어요' : '교환학생으로 등록됐어요')
      queryClient.invalidateQueries({ queryKey: ['exchange-profile'] })
      setTimeout(() => setSaveMsg(null), 3000)
    },
    onError: (err) => setSaveMsg(err instanceof Error ? err.message : '저장에 실패했어요'),
  })

  if (isLoading) return null

  return (
    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm">
      <div>
        <h2 className="font-semibold text-gray-900">교환학생 정보</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {profile ? `국가: ${profile.country?.name_ko ?? '—'}` : '아직 교환학생 프로필이 없어요. 아래에서 등록할 수 있어요.'}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">국가</label>
          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white text-sm"
          >
            <option value="">선택하세요</option>
            {countries.map((c) => (
              <option key={c.country_id} value={c.country_id}>
                {c.name_ko} ({c.name_en})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">거주 형태</label>
          <select
            value={housingType}
            onChange={(e) => setHousingType(e.target.value as HousingTypeEnum | '')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white text-sm"
          >
            <option value="">선택하세요</option>
            <option value="dorm">기숙사 (Dorm)</option>
            <option value="flat">자취/플랫 (Flat)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">학기</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white text-sm"
          >
            <option value="">선택하세요</option>
            <option value="2025-2">2025-2</option>
            <option value="2026-1">2026-1</option>
            <option value="2026-2">2026-2</option>
            <option value="2027-1">2027-1</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">선호 언어</label>
          <select
            value={languagePref}
            onChange={(e) => setLanguagePref(e.target.value as LanguagePrefEnum)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white text-sm"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </div>

        {saveMsg && (
          <p className={`text-xs ${saveMsg.includes('실패') || saveMsg.includes('필요') ? 'text-red-500' : 'text-green-600'}`}>
            {saveMsg}
          </p>
        )}

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saveMutation.isPending ? '저장 중...' : profile ? '교환학생 정보 저장' : '교환학생으로 등록'}
        </button>
      </div>
    </div>
  )
}
