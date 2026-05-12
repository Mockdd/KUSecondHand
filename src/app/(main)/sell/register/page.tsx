'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import React, { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'

// ──────────────────────────────────────────────────────────────────────────────
// 로컬 타입
// ──────────────────────────────────────────────────────────────────────────────

interface PackageItemRow {
  package_item_id: number
  category_id: number
  is_required: boolean
  priority_order: number
  category_name: string
}

// ──────────────────────────────────────────────────────────────────────────────
// 페이지
// ──────────────────────────────────────────────────────────────────────────────

function SellRegisterPageContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const packageId = Number(searchParams.get('packageId')) || null

  const { profile, isLoading: profileLoading } = useExchangeProfile()
  const userId = profile?.uid ?? null

  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [semester, setSemester] = useState('')
  const [price, setPrice] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── localStorage 체크 상태 복원 ──────────────────────────────────────────
  const storageKey = packageId ? `sell-register-checked-${packageId}` : null

  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setCheckedIds(new Set(JSON.parse(raw) as number[]))
    } catch { /* ignore */ }
  }, [storageKey])

  // 프로필 학기로 기본값 설정
  useEffect(() => {
    if (profile?.semester && !semester) {
      setSemester(profile.semester)
    }
  }, [profile?.semester, semester])

  // ── 패키지 물품 조회 (카테고리 이름 포함) ────────────────────────────────
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['package-items', packageId],
    queryFn: async (): Promise<PackageItemRow[]> => {
      if (!packageId) return []
      const { data, error } = await supabase
        .from('package_items')
        .select(
          'package_item_id, category_id, is_required, priority_order, categories(name)'
        )
        .eq('package_id', packageId)
        .order('is_required', { ascending: false })
        .order('priority_order', { ascending: true })

      // DB에 데이터 없으면 packageId별 mock 반환
      if (error || !data || data.length === 0) {
        return (MOCK_ITEMS[packageId] ?? MOCK_ITEMS[1]) as PackageItemRow[]
      }
      return data.map((item) => ({
        package_item_id: item.package_item_id,
        category_id: item.category_id,
        is_required: item.is_required,
        priority_order: item.priority_order,
        category_name:
          (Array.isArray(item.categories)
            ? (item.categories[0] as { name: string } | undefined)?.name
            : (item.categories as { name: string } | null)?.name) ?? '알 수 없음',
      }))
    },
    enabled: !!packageId && !profileLoading,
  })

  // ── 게시 가능 여부 ────────────────────────────────────────────────────────
  const parsedPrice = price.trim() === '' ? null : Number(price.replace(/,/g, ''))
  const isPostable =
    checkedIds.size > 0 &&
    semester.trim() !== '' &&
    parsedPrice !== null && parsedPrice > 0

  // ── 게시 mutation ─────────────────────────────────────────────────────────
  // TODO: package_matches.buyer_uid 를 nullable로 변경하는 마이그레이션 필요
  // (db/migrations/006_package_matches_nullable_buyer.sql)
  // 현재는 seller만 등록하고 /packages로 이동. buyer 매칭은 추후 구현.
  const postMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !packageId) throw new Error('로그인이 필요해요')
      if (!isPostable) throw new Error('게시 조건을 확인해주세요')

      const { data: match, error: matchError } = await supabase
        .from('package_matches')
        .insert({
          package_id: packageId,
          seller_uid: userId,
          buyer_uid: null,
          status: 'pending',
          semester,
          price: parsedPrice,
        })
        .select('match_id')
        .single()

      if (matchError) throw new Error(matchError.message)

      if (storageKey) {
        try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
      }
      return match?.match_id ?? null
    },
    onSuccess: () => {
      router.push('/packages')
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : '게시 중 오류가 발생했어요.'
      setSubmitError(msg)
    },
  })

  // ── 체크 토글 (localStorage 자동 저장) ──────────────────────────────────
  const toggleItem = (categoryId: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]))
        } catch { /* ignore */ }
      }
      return next
    })
  }

  const tabs = (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
      <Link
        href="/products/new"
        className="rounded-lg px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        일반 상품
      </Link>
      <span className="rounded-lg px-5 py-2 text-sm font-medium bg-white text-gray-900 shadow-sm">
        패키지
      </span>
    </div>
  )

  // ── 로딩 ─────────────────────────────────────────────────────────────────
  if (profileLoading || itemsLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">상품 등록</h1>
        {tabs}
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    )
  }

  // ── packageId 없음 ────────────────────────────────────────────────────────
  if (!packageId) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">상품 등록</h1>
        {tabs}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-gray-500 text-sm mb-3">템플릿을 먼저 선택해주세요.</p>
          <Link href="/sell/template" className="text-sm text-indigo-600 hover:text-indigo-500 underline">
            템플릿 선택하기
          </Link>
        </div>
      </div>
    )
  }

  const requiredItems = items.filter((i) => i.is_required)
  const optionalItems = items.filter((i) => !i.is_required)

  // ── 정상 ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">상품 등록</h1>

      {tabs}

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <SellStepHeader current={2} />

        <p className="text-sm text-gray-500">
          보유한 물품을 체크해주세요 — {checkedIds.size} / {items.length}개 선택됨
        </p>

        {/* 필수 항목 */}
        {requiredItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">필수 항목</p>
            <div className="flex flex-col gap-2">
              {requiredItems.map((item) => (
                <ItemRow
                  key={item.category_id}
                  item={item}
                  checked={checkedIds.has(item.category_id)}
                  onToggle={() => toggleItem(item.category_id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 선택 항목 */}
        {optionalItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">선택 항목</p>
            <div className="flex flex-col gap-2">
              {optionalItems.map((item) => (
                <ItemRow
                  key={item.category_id}
                  item={item}
                  checked={checkedIds.has(item.category_id)}
                  onToggle={() => toggleItem(item.category_id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 학기 선택 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">판매 학기</label>
          <p className="text-xs text-gray-400 mb-1">바이어가 입주하는 학기를 선택해주세요</p>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">선택하세요</option>
            <option value="2025-2">2025-2</option>
            <option value="2026-1">2026-1</option>
            <option value="2026-2">2026-2</option>
            <option value="2027-1">2027-1</option>
          </select>
        </div>

        {/* 가격 */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">희망 가격 <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-400 mb-1">패키지 전체 물품의 총 희망 가격을 입력해주세요</p>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={price}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '')
                setPrice(raw === '' ? '' : Number(raw).toLocaleString())
              }}
              placeholder="예: 50,000"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
          </div>
        </div>

        {/* 에러 메시지 */}
        {submitError && <p className="text-sm text-red-500">{submitError}</p>}

        {/* 게시하기 버튼 */}
        <button
          onClick={() => { setSubmitError(null); postMutation.mutate() }}
          disabled={!isPostable || postMutation.isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
        >
          {postMutation.isPending ? '게시 중...' : '게시하기'}
        </button>

        {checkedIds.size === 0 && (
          <p className="text-xs text-gray-400 text-center">보유 물품을 1개 이상 체크해주세요</p>
        )}
      </div>
    </div>
  )
}

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
// Mock 데이터 (packageId별 다른 물품 목록)
// 1 = 기숙사 기본, 2 = 자취/플랫셰어 풀, 3 = 고려대 기숙사
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_ITEMS: Record<number, PackageItemRow[]> = {
  1: [ // DORM_BASIC — 기숙사 기본
    { package_item_id: 1, category_id: 10, is_required: true,  priority_order: 1, category_name: '이불' },
    { package_item_id: 2, category_id: 11, is_required: true,  priority_order: 2, category_name: '베개' },
    { package_item_id: 3, category_id: 12, is_required: true,  priority_order: 3, category_name: '토퍼' },
    { package_item_id: 4, category_id: 13, is_required: true,  priority_order: 4, category_name: '수건' },
    { package_item_id: 5, category_id: 15, is_required: true,  priority_order: 5, category_name: '전기밥솥' },
    { package_item_id: 6, category_id: 17, is_required: false, priority_order: 6, category_name: '청소기' },
    { package_item_id: 7, category_id: 18, is_required: false, priority_order: 7, category_name: '빨래 건조대' },
    { package_item_id: 8, category_id: 19, is_required: false, priority_order: 8, category_name: '스탠드 조명' },
    { package_item_id: 9, category_id: 20, is_required: false, priority_order: 9, category_name: '행거' },
  ],
  2: [ // FLAT_FULL — 자취/플랫셰어 (기숙사 + 주방용품)
    { package_item_id: 1, category_id: 10, is_required: true,  priority_order: 1,  category_name: '이불' },
    { package_item_id: 2, category_id: 11, is_required: true,  priority_order: 2,  category_name: '베개' },
    { package_item_id: 3, category_id: 12, is_required: true,  priority_order: 3,  category_name: '토퍼' },
    { package_item_id: 4, category_id: 13, is_required: true,  priority_order: 4,  category_name: '수건' },
    { package_item_id: 5, category_id: 15, is_required: true,  priority_order: 5,  category_name: '전기밥솥' },
    { package_item_id: 6, category_id: 21, is_required: true,  priority_order: 6,  category_name: '냄비 세트' },
    { package_item_id: 7, category_id: 22, is_required: true,  priority_order: 7,  category_name: '프라이팬' },
    { package_item_id: 8, category_id: 23, is_required: true,  priority_order: 8,  category_name: '식기 세트' },
    { package_item_id: 9, category_id: 17, is_required: false, priority_order: 9,  category_name: '청소기' },
    { package_item_id: 10, category_id: 18, is_required: false, priority_order: 10, category_name: '빨래 건조대' },
    { package_item_id: 11, category_id: 24, is_required: false, priority_order: 11, category_name: '전자레인지' },
    { package_item_id: 12, category_id: 25, is_required: false, priority_order: 12, category_name: '커피포트' },
    { package_item_id: 13, category_id: 26, is_required: false, priority_order: 13, category_name: '선풍기' },
    { package_item_id: 14, category_id: 19, is_required: false, priority_order: 14, category_name: '스탠드 조명' },
    { package_item_id: 15, category_id: 20, is_required: false, priority_order: 15, category_name: '행거' },
  ],
  3: [ // INCOMING_DORM — 고려대 기숙사 입주 맞춤
    { package_item_id: 1, category_id: 10, is_required: true,  priority_order: 1, category_name: '이불' },
    { package_item_id: 2, category_id: 11, is_required: true,  priority_order: 2, category_name: '베개' },
    { package_item_id: 3, category_id: 12, is_required: true,  priority_order: 3, category_name: '토퍼' },
    { package_item_id: 4, category_id: 13, is_required: true,  priority_order: 4, category_name: '수건' },
    { package_item_id: 5, category_id: 15, is_required: true,  priority_order: 5, category_name: '전기밥솥' },
    { package_item_id: 6, category_id: 19, is_required: true,  priority_order: 6, category_name: '스탠드 조명' },
    { package_item_id: 7, category_id: 20, is_required: true,  priority_order: 7, category_name: '행거' },
    { package_item_id: 8, category_id: 27, is_required: true,  priority_order: 8, category_name: '슬리퍼' },
    { package_item_id: 9, category_id: 17, is_required: false, priority_order: 9, category_name: '청소기' },
    { package_item_id: 10, category_id: 18, is_required: false, priority_order: 10, category_name: '빨래 건조대' },
    { package_item_id: 11, category_id: 28, is_required: false, priority_order: 11, category_name: '멀티탭' },
    { package_item_id: 12, category_id: 26, is_required: false, priority_order: 12, category_name: '선풍기' },
  ],
}

// ──────────────────────────────────────────────────────────────────────────────
// 물품 행 (체크박스 + 세탁 인증 상태)
// ──────────────────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: PackageItemRow
  checked: boolean
  onToggle: () => void
}

function ItemRow({ item, checked, onToggle }: ItemRowProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-4 h-4 cursor-pointer accent-indigo-600"
      />
      <span className="text-sm text-gray-800">{item.category_name}</span>
    </label>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Default export — Suspense wrapper (useSearchParams 정적 prerender 요건)
// ──────────────────────────────────────────────────────────────────────────────

export default function SellRegisterPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">로딩 중...</p>}>
      <SellRegisterPageContent />
    </Suspense>
  )
}
