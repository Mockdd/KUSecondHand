'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'
import type { TemplateTypeEnum } from '@/types/supabase'

// ──────────────────────────────────────────────────────────────────────────────
// 템플릿 저장 훅 (localStorage)
// ──────────────────────────────────────────────────────────────────────────────

const TEMPLATE_SAVE_KEY = 'saved-templates'

function useSavedTemplates() {
  const [saved, setSaved] = useState<Set<number>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TEMPLATE_SAVE_KEY)
      if (raw) setSaved(new Set(JSON.parse(raw) as number[]))
    } catch { /* ignore */ }
  }, [])

  const toggle = useCallback((packageId: number) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(packageId)) next.delete(packageId)
      else next.add(packageId)
      try {
        localStorage.setItem(TEMPLATE_SAVE_KEY, JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }, [])

  return { saved, toggle }
}

// ──────────────────────────────────────────────────────────────────────────────
// 템플릿 메타 정보 (UI 표시용)
// ──────────────────────────────────────────────────────────────────────────────

const TEMPLATE_META: Record<TemplateTypeEnum, { label: string; desc: string }> = {
  DORM_BASIC: {
    label: '기숙사 기본 패키지',
    desc: '기숙사 생활 필수 물품 모음',
  },
  FLAT_FULL: {
    label: '자취/플랫셰어 풀 패키지',
    desc: '기숙사 패키지 + 주방용품 포함',
  },
  INCOMING_DORM: {
    label: '고려대 기숙사 입주 패키지',
    desc: '고려대 기숙사 규격 맞춤 구성',
  },
}

const TEMPLATE_ORDER: TemplateTypeEnum[] = ['DORM_BASIC', 'FLAT_FULL', 'INCOMING_DORM']

// ──────────────────────────────────────────────────────────────────────────────
// 셀 플로우 스텝 인디케이터
// ──────────────────────────────────────────────────────────────────────────────

function SellStepHeader({ current }: { current: 1 | 2 }) {
  const steps = ['템플릿 선택', '물품 체크']
  return (
    <div className="flex items-center mb-6">
      {steps.map((label, i) => {
        const step = (i + 1) as 1 | 2
        const isDone = step < current
        const isActive = step === current
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border ${
                isActive ? 'bg-indigo-600 text-white border-indigo-600' :
                isDone   ? 'bg-gray-300 text-white border-gray-300' :
                           'border-gray-200 text-gray-300'
              }`}>
                {isDone ? '✓' : step}
              </div>
              <span className={`text-xs whitespace-nowrap ${isActive ? 'text-indigo-600 font-medium' : isDone ? 'text-gray-400' : 'text-gray-300'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 ${isDone ? 'bg-gray-300' : 'bg-gray-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 페이지
// ──────────────────────────────────────────────────────────────────────────────

export default function SellTemplatePage() {
  const supabase = createClient()
  const router = useRouter()
  const { profile, isLoading: profileLoading } = useExchangeProfile()
  const { saved, toggle: toggleSave } = useSavedTemplates()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['sell-templates', profile?.housing_type, profile?.region_group],
    queryFn: async () => {
      // DB 없는 개발 환경: mock 데이터 반환
      const { data: packages, error } = await supabase
        .from('essential_packages')
        .select('package_id, template_type, region_group, housing_type, country_code')

      // DB에 데이터 없으면 mock 반환
      if (error || !packages || packages.length === 0) {
        return TEMPLATE_ORDER.map((type, i) => ({
          package_id: i + 1,
          template_type: type,
          counts: { total: [9, 15, 12][i], required: [6, 10, 8][i] },
        }))
      }

      // 2. 물품 수 집계
      const { data: items } = await supabase
        .from('package_items')
        .select('package_id, is_required')

      const countMap = (items ?? []).reduce<
        Record<number, { total: number; required: number }>
      >((acc, item) => {
        if (!acc[item.package_id]) acc[item.package_id] = { total: 0, required: 0 }
        acc[item.package_id].total += 1
        if (item.is_required) acc[item.package_id].required += 1
        return acc
      }, {})

      // 3. 템플릿 타입별로 사용자 프로필에 맞는 최적 패키지 선택
      return TEMPLATE_ORDER.map((type) => {
        const candidates = packages.filter((p) => p.template_type === type)
        // 우선순위: housing_type 일치 > housing_type null > 첫 번째
        const best =
          candidates.find((p) => p.housing_type === (profile?.housing_type ?? null)) ??
          candidates.find((p) => p.housing_type === null) ??
          candidates[0]

        if (!best) return null
        return {
          package_id: best.package_id,
          template_type: type,
          counts: countMap[best.package_id] ?? { total: 0, required: 0 },
        }
      }).filter((t): t is NonNullable<typeof t> => t !== null)
    },
    enabled: !profileLoading,
  })

  const tabs = (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
      <button
        onClick={() => router.push('/products/new')}
        className="rounded-lg px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        일반 상품
      </button>
      <button
        className="rounded-lg px-5 py-2 text-sm font-medium bg-white text-gray-900 shadow-sm"
      >
        패키지
      </button>
    </div>
  )

  // ── 로딩 ─────────────────────────────────────────────────────────────────
  if (profileLoading || isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">상품 등록</h1>
        {tabs}
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    )
  }

  // ── 정상 (+ 템플릿 없음 안내 포함) ──────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">상품 등록</h1>

      {tabs}

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <SellStepHeader current={1} />

        <p className="text-sm text-gray-500">
          본인의 거주 형태에 맞는 템플릿을 선택해주세요.
        </p>

        {templates.length === 0 ? (
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
            <p className="font-medium mb-1">템플릿 데이터가 없어요 (개발용 안내)</p>
            <p className="text-xs text-yellow-700">
              Supabase에 essential_packages 및 package_items seed 데이터를 삽입해주세요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {[...templates]
              .sort((a, b) => (saved.has(a.package_id) ? 0 : 1) - (saved.has(b.package_id) ? 0 : 1))
              .map((t) => {
                const meta = TEMPLATE_META[t.template_type]
                const isSaved = saved.has(t.package_id)
                return (
                  <div
                    key={t.package_id}
                    className={`rounded-xl border p-4 transition-colors ${isSaved ? 'border-indigo-300' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-medium text-gray-900">{meta.label}</p>
                      <button
                        onClick={() => toggleSave(t.package_id)}
                        className={`text-lg leading-none shrink-0 transition-colors ${isSaved ? 'text-red-500' : 'text-gray-300 hover:text-gray-500'}`}
                        aria-label={isSaved ? '저장 취소' : '저장'}
                      >
                        {isSaved ? '♥' : '♡'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{meta.desc}</p>
                    <p className="text-xs text-gray-400 mb-4">
                      필수 {t.counts.required}개 · 전체 {t.counts.total}개
                    </p>
                    <button
                      onClick={() => router.push(`/sell/register?packageId=${t.package_id}`)}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
                    >
                      이 템플릿으로 등록하기
                    </button>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
