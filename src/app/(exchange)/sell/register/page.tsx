'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import React, { useState, useEffect } from 'react'
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
  requires_hygiene_cert: boolean
  category_name: string
}

interface CertRow {
  cert_id: number
  category_id: number
  status: string
}

// ──────────────────────────────────────────────────────────────────────────────
// 페이지
// ──────────────────────────────────────────────────────────────────────────────

export default function SellRegisterPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const packageId = Number(searchParams.get('packageId')) || null

  const { profile, isLoading: profileLoading } = useExchangeProfile()
  const userId = profile?.uid ?? null

  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [semester, setSemester] = useState('')
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
          'package_item_id, category_id, is_required, priority_order, requires_hygiene_cert, categories(name)'
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
        requires_hygiene_cert: item.requires_hygiene_cert,
        category_name:
          (Array.isArray(item.categories)
            ? (item.categories[0] as { name: string } | undefined)?.name
            : (item.categories as { name: string } | null)?.name) ?? '알 수 없음',
      }))
    },
    enabled: !!packageId && !profileLoading,
  })

  // ── 세탁 인증 현황 조회 ──────────────────────────────────────────────────
  const { data: certs = [] } = useQuery({
    queryKey: ['hygiene-certs', userId],
    queryFn: async (): Promise<CertRow[]> => {
      if (!userId) return []
      const { data } = await supabase
        .from('hygiene_certifications')
        .select('cert_id, category_id, status')
        .eq('seller_uid', userId)
      return data ?? []
    },
    enabled: !!userId,
  })

  const certMap = certs.reduce<Record<number, CertRow>>((acc, c) => {
    acc[c.category_id] = c
    return acc
  }, {})

  // ── 게시 가능 여부 ────────────────────────────────────────────────────────
  // 체크된 물품 중 세탁 인증 필요 + 미승인 항목 목록
  const uncertifiedChecked = items.filter(
    (item) =>
      checkedIds.has(item.category_id) &&
      item.requires_hygiene_cert &&
      certMap[item.category_id]?.status !== 'approved'
  )
  const isPostable =
    checkedIds.size > 0 && semester.trim() !== '' && uncertifiedChecked.length === 0

  // ── 게시 mutation ─────────────────────────────────────────────────────────
  const postMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !packageId) throw new Error('로그인이 필요해요')
      if (!isPostable) throw new Error('게시 조건을 확인해주세요')

      // 1. package_matches INSERT
      // buyer_uid = seller_uid: 초기 등록 상태 (바이어 미정)
      // ⚠️ DB의 chk_package_matches_no_self 제약 조건 확인 필요
      const { data: match, error: matchError } = await supabase
        .from('package_matches')
        .insert({
          package_id: packageId,
          seller_uid: userId,
          buyer_uid: userId,
          status: 'pending',
          semester,
        })
        .select('match_id')
        .single()

      if (matchError) throw matchError

      // 2. package_listings INSERT (체크된 물품 전체)
      const listings = Array.from(checkedIds).map((categoryId) => ({
        match_id: match.match_id,
        seller_uid: userId,
        category_id: categoryId,
        status: 'selling' as const,
        semester,
        cert_id: certMap[categoryId]?.cert_id ?? null,
      }))

      const { error: listingsError } = await supabase
        .from('package_listings')
        .insert(listings)

      if (listingsError) throw listingsError

      return match.match_id
    },
    onSuccess: (matchId) => {
      if (storageKey) {
        try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
      }
      router.push(`/packages/${matchId}`)
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

  // ── 로딩 ─────────────────────────────────────────────────────────────────
  if (profileLoading || itemsLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  // ── packageId 없음 ────────────────────────────────────────────────────────
  if (!packageId) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-sm mb-2">템플릿을 먼저 선택해주세요.</p>
        <Link href="/sell/template" className="text-sm underline text-gray-600">
          템플릿 선택하기
        </Link>
      </div>
    )
  }

  const requiredItems = items.filter((i) => i.is_required)
  const optionalItems = items.filter((i) => !i.is_required)

  // ── 정상 ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="text-gray-400 text-sm">←</button>
        <h1 className="text-lg font-bold">패키지 등록</h1>
      </div>

      <SellStepHeader current={2} />

      <p className="text-sm text-gray-400 mb-6">
        보유한 물품을 체크해주세요 — {checkedIds.size} / {items.length}개 선택됨
      </p>

      {/* 필수 항목 */}
      {requiredItems.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">필수 항목</p>
          <div className="flex flex-col gap-2">
            {requiredItems.map((item) => (
              <ItemRow
                key={item.category_id}
                item={item}
                checked={checkedIds.has(item.category_id)}
                cert={certMap[item.category_id]}
                onToggle={() => toggleItem(item.category_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 선택 항목 */}
      {optionalItems.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">선택 항목</p>
          <div className="flex flex-col gap-2">
            {optionalItems.map((item) => (
              <ItemRow
                key={item.category_id}
                item={item}
                checked={checkedIds.has(item.category_id)}
                cert={certMap[item.category_id]}
                onToggle={() => toggleItem(item.category_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 학기 선택 */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 block mb-1">판매 학기</label>
        <p className="text-xs text-gray-400 mb-1">바이어가 입주하는 학기를 선택해주세요</p>
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

      {/* 세탁 인증 경고 */}
      {uncertifiedChecked.length > 0 && (
        <div className="border border-yellow-300 bg-yellow-50 rounded p-3 mb-4">
          <p className="text-xs text-yellow-800 font-medium mb-1">
            ⚠️ 세탁 인증 미완료 항목이 있어요
          </p>
          <p className="text-xs text-yellow-700 mb-2">
            {uncertifiedChecked.map((i) => i.category_name).join(', ')}
          </p>
          <Link href="/sell/hygiene" className="text-xs text-yellow-700 underline">
            세탁 인증하러 가기
          </Link>
        </div>
      )}

      {/* 에러 메시지 */}
      {submitError && <p className="text-sm text-red-500 mb-4">{submitError}</p>}

      {/* 다음 단계 / 게시하기 버튼 */}
      {uncertifiedChecked.length > 0 ? (
        <Link
          href="/sell/hygiene"
          className="block w-full px-4 py-3 bg-black text-white text-sm rounded text-center"
        >
          세탁 인증하러 가기 →
        </Link>
      ) : (
        <button
          onClick={() => {
            setSubmitError(null)
            postMutation.mutate()
          }}
          disabled={!isPostable || postMutation.isPending}
          className="w-full px-4 py-3 bg-black text-white text-sm rounded disabled:opacity-40"
        >
          {postMutation.isPending ? '게시 중...' : '게시하기'}
        </button>
      )}

      {/* 비활성 안내 */}
      {checkedIds.size === 0 && (
        <p className="text-xs text-gray-400 text-center mt-2">
          보유 물품을 1개 이상 체크해주세요
        </p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 셀 플로우 스텝 인디케이터
// ──────────────────────────────────────────────────────────────────────────────

function SellStepHeader({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['템플릿 선택', '물품 체크', '세탁 인증']
  return (
    <div className="flex items-center mb-6">
      {steps.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3
        const isDone = step < current
        const isActive = step === current
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border ${
                isActive ? 'bg-black text-white border-black' :
                isDone   ? 'bg-gray-300 text-white border-gray-300' :
                           'border-gray-200 text-gray-300'
              }`}>
                {isDone ? '✓' : step}
              </div>
              <span className={`text-xs whitespace-nowrap ${isActive ? 'text-black font-medium' : isDone ? 'text-gray-400' : 'text-gray-300'}`}>
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
    { package_item_id: 1, category_id: 10, is_required: true,  priority_order: 1, requires_hygiene_cert: true,  category_name: '이불' },
    { package_item_id: 2, category_id: 11, is_required: true,  priority_order: 2, requires_hygiene_cert: true,  category_name: '베개' },
    { package_item_id: 3, category_id: 12, is_required: true,  priority_order: 3, requires_hygiene_cert: true,  category_name: '토퍼' },
    { package_item_id: 4, category_id: 13, is_required: true,  priority_order: 4, requires_hygiene_cert: false, category_name: '수건' },
    { package_item_id: 5, category_id: 15, is_required: true,  priority_order: 5, requires_hygiene_cert: false, category_name: '전기밥솥' },
    { package_item_id: 6, category_id: 17, is_required: false, priority_order: 6, requires_hygiene_cert: false, category_name: '청소기' },
    { package_item_id: 7, category_id: 18, is_required: false, priority_order: 7, requires_hygiene_cert: false, category_name: '빨래 건조대' },
    { package_item_id: 8, category_id: 19, is_required: false, priority_order: 8, requires_hygiene_cert: false, category_name: '스탠드 조명' },
    { package_item_id: 9, category_id: 20, is_required: false, priority_order: 9, requires_hygiene_cert: false, category_name: '행거' },
  ],
  2: [ // FLAT_FULL — 자취/플랫셰어 (기숙사 + 주방용품)
    { package_item_id: 1, category_id: 10, is_required: true,  priority_order: 1,  requires_hygiene_cert: true,  category_name: '이불' },
    { package_item_id: 2, category_id: 11, is_required: true,  priority_order: 2,  requires_hygiene_cert: true,  category_name: '베개' },
    { package_item_id: 3, category_id: 12, is_required: true,  priority_order: 3,  requires_hygiene_cert: true,  category_name: '토퍼' },
    { package_item_id: 4, category_id: 13, is_required: true,  priority_order: 4,  requires_hygiene_cert: false, category_name: '수건' },
    { package_item_id: 5, category_id: 15, is_required: true,  priority_order: 5,  requires_hygiene_cert: false, category_name: '전기밥솥' },
    { package_item_id: 6, category_id: 21, is_required: true,  priority_order: 6,  requires_hygiene_cert: false, category_name: '냄비 세트' },
    { package_item_id: 7, category_id: 22, is_required: true,  priority_order: 7,  requires_hygiene_cert: false, category_name: '프라이팬' },
    { package_item_id: 8, category_id: 23, is_required: true,  priority_order: 8,  requires_hygiene_cert: false, category_name: '식기 세트' },
    { package_item_id: 9, category_id: 17, is_required: false, priority_order: 9,  requires_hygiene_cert: false, category_name: '청소기' },
    { package_item_id: 10, category_id: 18, is_required: false, priority_order: 10, requires_hygiene_cert: false, category_name: '빨래 건조대' },
    { package_item_id: 11, category_id: 24, is_required: false, priority_order: 11, requires_hygiene_cert: false, category_name: '전자레인지' },
    { package_item_id: 12, category_id: 25, is_required: false, priority_order: 12, requires_hygiene_cert: false, category_name: '커피포트' },
    { package_item_id: 13, category_id: 26, is_required: false, priority_order: 13, requires_hygiene_cert: false, category_name: '선풍기' },
    { package_item_id: 14, category_id: 19, is_required: false, priority_order: 14, requires_hygiene_cert: false, category_name: '스탠드 조명' },
    { package_item_id: 15, category_id: 20, is_required: false, priority_order: 15, requires_hygiene_cert: false, category_name: '행거' },
  ],
  3: [ // INCOMING_DORM — 고려대 기숙사 입주 맞춤
    { package_item_id: 1, category_id: 10, is_required: true,  priority_order: 1, requires_hygiene_cert: true,  category_name: '이불' },
    { package_item_id: 2, category_id: 11, is_required: true,  priority_order: 2, requires_hygiene_cert: true,  category_name: '베개' },
    { package_item_id: 3, category_id: 12, is_required: true,  priority_order: 3, requires_hygiene_cert: true,  category_name: '토퍼' },
    { package_item_id: 4, category_id: 13, is_required: true,  priority_order: 4, requires_hygiene_cert: false, category_name: '수건' },
    { package_item_id: 5, category_id: 15, is_required: true,  priority_order: 5, requires_hygiene_cert: false, category_name: '전기밥솥' },
    { package_item_id: 6, category_id: 19, is_required: true,  priority_order: 6, requires_hygiene_cert: false, category_name: '스탠드 조명' },
    { package_item_id: 7, category_id: 20, is_required: true,  priority_order: 7, requires_hygiene_cert: false, category_name: '행거' },
    { package_item_id: 8, category_id: 27, is_required: true,  priority_order: 8, requires_hygiene_cert: false, category_name: '슬리퍼' },
    { package_item_id: 9, category_id: 17, is_required: false, priority_order: 9, requires_hygiene_cert: false, category_name: '청소기' },
    { package_item_id: 10, category_id: 18, is_required: false, priority_order: 10, requires_hygiene_cert: false, category_name: '빨래 건조대' },
    { package_item_id: 11, category_id: 28, is_required: false, priority_order: 11, requires_hygiene_cert: false, category_name: '멀티탭' },
    { package_item_id: 12, category_id: 26, is_required: false, priority_order: 12, requires_hygiene_cert: false, category_name: '선풍기' },
  ],
}

// ──────────────────────────────────────────────────────────────────────────────
// 물품 행 (체크박스 + 세탁 인증 상태)
// ──────────────────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: PackageItemRow
  checked: boolean
  cert: CertRow | undefined
  onToggle: () => void
}

function ItemRow({ item, checked, cert, onToggle }: ItemRowProps) {
  const certBadge = (() => {
    if (!item.requires_hygiene_cert) return null
    if (!cert) return <span className="text-xs text-gray-400">인증 필요</span>
    if (cert.status === 'approved')
      return <span className="text-xs text-green-600">세탁완료 ✅</span>
    if (cert.status === 'pending')
      return <span className="text-xs text-yellow-600">검토 중 ⏳</span>
    if (cert.status === 'rejected')
      return <span className="text-xs text-red-600">반려됨 ❌</span>
    return null
  })()

  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 cursor-pointer"
        />
        <span className="text-sm text-gray-800">{item.category_name}</span>
      </div>
      {checked && certBadge}
    </label>
  )
}
