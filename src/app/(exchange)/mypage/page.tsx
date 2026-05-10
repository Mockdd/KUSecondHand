'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'
import type { HousingTypeEnum, LanguagePrefEnum, ExchangeRoleEnum } from '@/types/supabase'

export default function MyPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { profile, isLoading } = useExchangeProfile()

  const [housingType, setHousingType] = useState<HousingTypeEnum | ''>('')
  const [semester, setSemester] = useState('')
  const [languagePref, setLanguagePref] = useState<LanguagePrefEnum>('ko')
  const [role, setRole] = useState<ExchangeRoleEnum>('incoming')
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // 프로필 로드 시 초기값 설정
  useEffect(() => {
    if (profile) {
      setHousingType(profile.housing_type ?? '')
      setSemester(profile.semester ?? '')
      setLanguagePref(profile.language_pref ?? 'ko')
      setRole(profile.role ?? 'incoming')
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.uid) throw new Error('로그인이 필요해요')
      const { error } = await supabase
        .from('exchange_students')
        .update({
          housing_type: housingType || null,
          semester: semester || null,
          language_pref: languagePref,
          role,
        })
        .eq('uid', profile.uid)
      if (error) throw error
    },
    onSuccess: () => {
      setSaveMsg('저장됐어요 — 홈에서 메뉴가 바뀐 것을 확인하세요')
      queryClient.invalidateQueries({ queryKey: ['exchange-profile'] })
      setTimeout(() => setSaveMsg(null), 3000)
    },
    onError: () => setSaveMsg('저장에 실패했어요'),
  })

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (isLoading) {
    return <div className="p-8"><p className="text-gray-500">로딩 중...</p></div>
  }

  const displayProfile = profile ?? MOCK_PROFILE

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/" className="text-gray-400 text-sm">←</Link>
        <h1 className="text-xl font-bold">마이페이지</h1>
      </div>

      {!profile && (
        <div className="border border-yellow-300 bg-yellow-50 rounded p-2 mb-4">
          <p className="text-xs text-yellow-700">개발 미리보기 — 실제 데이터 아님</p>
        </div>
      )}

      {(() => {
        const p = displayProfile
        return (
        <>
          {/* 프로필 요약 */}
          <div className="border border-gray-200 rounded p-4 mb-6 text-sm">
            <p className="text-gray-500 mb-2 text-xs">UID: {p.uid}</p>
            <p>
              역할:{' '}
              <span className="font-medium">
                {p.role === 'incoming' ? 'Incoming (바이어)' : p.role === 'outgoing' ? 'Outgoing (셀러)' : '미설정'}
              </span>
            </p>
            {p.country && (
              <p>
                국가: <span className="font-medium">{p.country.name_ko}</span>
              </p>
            )}
          </div>

          {/* 프로필 편집 */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">프로필 편집</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">거주 형태</label>
                <select
                  value={housingType}
                  onChange={(e) => setHousingType(e.target.value as HousingTypeEnum | '')}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                >
                  <option value="">선택하세요</option>
                  <option value="dorm">기숙사 (Dorm)</option>
                  <option value="flat">자취/플랫 (Flat)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">학기</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                >
                  <option value="">선택하세요</option>
                  <option value="2025-2">2025-2</option>
                  <option value="2026-1">2026-1</option>
                  <option value="2026-2">2026-2</option>
                  <option value="2027-1">2027-1</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">선호 언어</label>
                <select
                  value={languagePref}
                  onChange={(e) => setLanguagePref(e.target.value as LanguagePrefEnum)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">역할</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as ExchangeRoleEnum)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                >
                  <option value="incoming">Incoming — 바이어 (물품 구매)</option>
                  <option value="outgoing">Outgoing — 셀러 (물품 판매)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  역할을 바꾸면 홈 메뉴가 즉시 전환됩니다
                </p>
              </div>

              {saveMsg && (
                <p className={`text-xs ${saveMsg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>
                  {saveMsg}
                </p>
              )}

              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-black text-white text-sm rounded disabled:opacity-40"
              >
                {saveMutation.isPending ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>

          {/* 바로가기 */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">바로가기</h2>
            <div className="flex flex-col gap-2">
              <Link href="/packages" className="px-4 py-2 border border-gray-200 rounded text-sm">
                내 패키지 현황
              </Link>
              <Link href="/wishlist" className="px-4 py-2 border border-gray-200 rounded text-sm">
                알림 신청 목록
              </Link>
              <Link href="/sell/hygiene" className="px-4 py-2 border border-gray-200 rounded text-sm">
                세탁 인증 관리
              </Link>
            </div>
          </div>

          {/* 로그아웃 */}
          {profile && (
            <button
              onClick={handleSignOut}
              className="px-4 py-2 border border-gray-300 text-sm rounded text-gray-600"
            >
              로그아웃
            </button>
          )}
        </>
        )
      })()}
    </div>
  )
}

const MOCK_PROFILE = {
  uid: 'mock-uid-preview',
  role: 'outgoing' as const,
  region_group: 'E3',
  housing_type: 'dorm' as const,
  semester: '2026-1',
  language_pref: 'ko' as const,
  onboarding_completed: true,
  country_id: 1,
  created_at: '',
  updated_at: '',
  country: { country_code: 'E3', name_ko: '독일어권', name_en: 'German-speaking' },
}
