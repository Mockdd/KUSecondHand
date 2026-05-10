'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'
import { getPackageWithFallback, getFallbackMessage } from '@/lib/utils/fallback'
import {
  calculateSellerScore,
  calculateOwnershipRate,
  calculateHygieneCertRate,
  compareSellerScore,
} from '@/lib/utils/score'
import { formatSemester } from '@/lib/utils/format'
import type { PackageFallbackResult, SellerWithScore } from '@/types/package'

// ──────────────────────────────────────────────────────────────────────────────
// 로컬 타입 — Supabase 중첩 join 결과를 명시적으로 정의
// ──────────────────────────────────────────────────────────────────────────────

interface RawPackageListing {
  listing_id: number
  category_id: number
  status: string
  cert_id: number | null
}

interface RawMatch {
  match_id: number
  seller_uid: string
  semester: string | null
  status: string
  package_listings: RawPackageListing[]
}

interface SellerQueryResult {
  sellers: SellerWithScore[]
  is_different_semester: boolean
}

// ──────────────────────────────────────────────────────────────────────────────
// 셀러 목록 조회 + 점수 계산 함수
// ──────────────────────────────────────────────────────────────────────────────

async function fetchSellersWithScore(
  supabase: ReturnType<typeof createClient>,
  packageId: number,
  userSemester: string,
  userId: string
): Promise<SellerQueryResult> {
  // ── 1. 패키지 구성 물품 조회 (총 개수, 세탁 인증 필요 카테고리 Set) ────────
  const { data: packageItems, error: itemsError } = await supabase
    .from('package_items')
    .select('category_id, requires_hygiene_cert')
    .eq('package_id', packageId)

  if (itemsError) {
    console.error('[packages] package_items 조회 실패:', itemsError)
    throw new Error('패키지 정보를 불러올 수 없어요')
  }

  const totalCount = packageItems?.length ?? 0
  const hygieneRequiredCategoryIds = new Set(
    (packageItems ?? [])
      .filter((item) => item.requires_hygiene_cert)
      .map((item) => item.category_id)
  )

  // ── 2. 셀러 매칭 조회 헬퍼 (중복 제거) ──────────────────────────────────
  const fetchMatches = async (sameSemester: boolean) => {
    let query = supabase
      .from('package_matches')
      .select(`
        match_id,
        seller_uid,
        semester,
        status,
        package_listings (
          listing_id,
          category_id,
          status,
          cert_id
        )
      `)
      .eq('package_id', packageId)
      .in('status', ['pending', 'matched'])
      .limit(10)

    query = sameSemester
      ? query.eq('semester', userSemester)
      : query.neq('semester', userSemester)

    return query
  }

  // ── 3. 같은 학기 우선 → 없으면 다른 학기 Fallback ─────────────────────────
  const { data: sameSemData, error: sameErr } = await fetchMatches(true)
  if (sameErr) {
    console.error('[packages] 셀러(같은 학기) 조회 실패:', sameErr)
    throw new Error('셀러 목록을 불러올 수 없어요')
  }

  let rawMatches = (sameSemData ?? []) as RawMatch[]
  let isDifferentSemester = false

  if (rawMatches.length === 0) {
    const { data: diffSemData, error: diffErr } = await fetchMatches(false)
    if (diffErr) {
      console.error('[packages] 셀러(다른 학기) 조회 실패:', diffErr)
      throw new Error('셀러 목록을 불러올 수 없어요')
    }
    rawMatches = (diffSemData ?? []) as RawMatch[]
    isDifferentSemester = rawMatches.length > 0
  }

  if (rawMatches.length === 0) {
    return { sellers: [], is_different_semester: false }
  }

  const sellerUids = [...new Set(rawMatches.map((m) => m.seller_uid))]

  // ── 4. 셀러 닉네임 일괄 조회 ─────────────────────────────────────────────
  const { data: usersData } = await supabase
    .from('users')
    .select('uid, nickname')
    .in('uid', sellerUids)

  const nicknameMap = new Map<string, string>(
    (usersData ?? []).map((u) => [u.uid, u.nickname])
  )

  // ── 5. 세탁 인증 완료 현황 일괄 조회 (approved만) ────────────────────────
  const { data: approvedCerts } = await supabase
    .from('hygiene_certifications')
    .select('seller_uid, category_id')
    .in('seller_uid', sellerUids)
    .eq('status', 'approved')

  // seller_uid → 승인된 category_id Set
  const certMap = new Map<string, Set<number>>()
  ;(approvedCerts ?? []).forEach((cert) => {
    if (!certMap.has(cert.seller_uid)) {
      certMap.set(cert.seller_uid, new Set())
    }
    certMap.get(cert.seller_uid)!.add(cert.category_id)
  })

  // ── 6. 현재 유저의 기존 매칭 요청 확인 (already_requested + room_id) ───────
  const { data: myRequests } = await supabase
    .from('package_matches')
    .select('match_id, seller_uid, chat_rooms(room_id)')
    .eq('package_id', packageId)
    .eq('buyer_uid', userId)
    .in('status', ['pending', 'matched'])

  const requestedSellerUids = new Set(
    (myRequests ?? []).map((r) => r.seller_uid)
  )

  // seller_uid → room_id 맵
  const sellerRoomMap = new Map<string, number>()
  ;(myRequests ?? []).forEach((r) => {
    const room = Array.isArray(r.chat_rooms) ? r.chat_rooms[0] : r.chat_rooms
    const roomId = (room as { room_id: number } | null)?.room_id
    if (roomId) sellerRoomMap.set(r.seller_uid, roomId)
  })

  // ── 7. 셀러별 점수 계산 ──────────────────────────────────────────────────
  const hygieneRequiredCount = hygieneRequiredCategoryIds.size

  const sellers: SellerWithScore[] = rawMatches.map((match) => {
    const listings = match.package_listings ?? []
    const ownedCount = listings.filter((l) => l.status === 'selling').length

    const approvedForSeller = certMap.get(match.seller_uid) ?? new Set<number>()
    const certifiedCount = [...hygieneRequiredCategoryIds].filter((catId) =>
      approvedForSeller.has(catId)
    ).length

    return {
      match_id: match.match_id,
      seller_uid: match.seller_uid,
      seller_name: nicknameMap.get(match.seller_uid) ?? '알 수 없음',
      semester: match.semester ?? '',
      is_different_semester: isDifferentSemester,
      owned_count: ownedCount,
      total_count: totalCount,
      ownership_rate: calculateOwnershipRate(ownedCount, totalCount),
      hygiene_cert_rate: calculateHygieneCertRate(certifiedCount, hygieneRequiredCount),
      score: calculateSellerScore(ownedCount, totalCount, certifiedCount, hygieneRequiredCount),
      already_requested: requestedSellerUids.has(match.seller_uid),
      room_id: sellerRoomMap.get(match.seller_uid) ?? null,
    }
  })

  // ── 8. 점수 정렬 → 상위 5개 ─────────────────────────────────────────────
  sellers.sort(compareSellerScore)

  return { sellers: sellers.slice(0, 5), is_different_semester: isDifferentSemester }
}

// ──────────────────────────────────────────────────────────────────────────────
// 패키지 추천 목록 페이지
// ──────────────────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const supabase = createClient()
  const { profile, isLoading: profileLoading, error: profileError } = useExchangeProfile()

  // ── Query 1: 패키지 Fallback 조회 ────────────────────────────────────────
  const {
    data: fallbackResult,
    isLoading: packageLoading,
    error: packageError,
  } = useQuery<PackageFallbackResult>({
    queryKey: [
      'package-fallback',
      profile?.country?.country_code,
      profile?.region_group,
      profile?.housing_type,
    ],
    enabled: !!profile,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      getPackageWithFallback(
        supabase,
        profile!.country?.country_code ?? profile!.region_group ?? '',
        profile!.region_group ?? '',
        (profile!.housing_type ?? 'dorm') as 'dorm' | 'flat'
      ),
  })

  const pkg = fallbackResult?.data
  const packageId = pkg?.package_id

  // ── Query 2: 셀러 목록 + 점수 계산 ───────────────────────────────────────
  const {
    data: sellerResult,
    isLoading: sellersLoading,
    error: sellersError,
  } = useQuery<SellerQueryResult>({
    queryKey: ['package-sellers', packageId, profile?.semester],
    enabled: !!packageId && !!profile?.semester,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('NOT_AUTHENTICATED')

      return fetchSellersWithScore(supabase, packageId!, profile!.semester!, user.id)
    },
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 렌더링 분기
  // ──────────────────────────────────────────────────────────────────────────

  const isLoading = profileLoading || packageLoading || sellersLoading

  // ── 개발 미리보기 (미로그인) ──────────────────────────────────────────────
  if (!profileLoading && !profile) {
    return <DevPreview />
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">불러오는 중...</p>
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-500">{profileError}</p>
      </div>
    )
  }

  if (packageError || sellersError) {
    const msg =
      packageError instanceof Error
        ? packageError.message
        : sellersError instanceof Error
          ? sellersError.message
          : '알 수 없는 오류가 발생했어요'
    return (
      <div className="p-8">
        <BackLink />
        <p className="text-sm text-red-500 mb-4">{msg}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 border border-gray-300 text-sm rounded"
        >
          다시 시도
        </button>
      </div>
    )
  }

  // 패키지 없음 (Fallback 3순위까지 결과 없음)
  if (!pkg || fallbackResult?.tier === 0) {
    return (
      <div className="p-8">
        <BackLink />
        <p className="text-sm text-gray-600 mb-4">
          현재 조건에 맞는 패키지가 없어요.
        </p>
        <Link
          href="/wishlist"
          className="inline-block px-4 py-2 border border-gray-300 text-sm rounded"
        >
          알림 신청하기
        </Link>
      </div>
    )
  }

  const { saved, toggle: toggleSave } = useSavedSellers()

  const sellers = sellerResult?.sellers ?? []
  const fallbackMessage = getFallbackMessage(
    fallbackResult.tier,
    fallbackResult.label,
    pkg.region_group ?? undefined
  )

  return (
    <div className="p-8">
      {/* 헤더 */}
      <BackLink />
      <h1 className="text-lg font-bold mb-1">패키지 추천</h1>
      <p className="text-sm text-gray-400 mb-4">
        {profile?.region_group} ·{' '}
        {profile?.housing_type === 'dorm' ? '기숙사' : '자취'} ·{' '}
        {profile?.semester ? formatSemester(profile.semester) : ''}
      </p>

      {/* Fallback 안내 (2순위·3순위 적용 시) */}
      {fallbackMessage && (
        <div className="border border-yellow-200 bg-yellow-50 rounded p-3 mb-4">
          <p className="text-sm text-yellow-800">{fallbackMessage}</p>
        </div>
      )}

      {/* 다른 학기 안내 */}
      {sellerResult?.is_different_semester && (
        <div className="border border-gray-200 bg-gray-50 rounded p-3 mb-4">
          <p className="text-sm text-gray-600">
            같은 학기 셀러가 없어 다른 학기 매물을 표시해요.
          </p>
        </div>
      )}

      {/* 패키지명 */}
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-1">추천 패키지</p>
        <p className="font-semibold">{pkg.name.ko}</p>
      </div>

      {/* 셀러 없음 */}
      {sellers.length === 0 && (
        <div className="border border-gray-100 rounded p-4">
          <p className="text-sm text-gray-500 mb-3">현재 등록된 셀러가 없어요.</p>
          <Link
            href="/wishlist"
            className="inline-block px-4 py-2 border border-gray-300 text-sm rounded"
          >
            알림 신청하기
          </Link>
        </div>
      )}

      {/* 셀러 카드 목록 — 저장한 카드 상단 표시 */}
      {sellers.length > 0 && (
        <ul className="flex flex-col gap-3">
          {[...sellers]
            .sort((a, b) => {
              const aSaved = saved.has(a.match_id) ? 0 : 1
              const bSaved = saved.has(b.match_id) ? 0 : 1
              return aSaved - bSaved
            })
            .map((seller) => (
              <SellerCard
                key={seller.match_id}
                seller={seller}
                isSaved={saved.has(seller.match_id)}
                onToggleSave={toggleSave}
              />
            ))}
        </ul>
      )}

      {/* 조건 변경 */}
      <div className="mt-8 pt-4 border-t border-gray-100">
        <Link href="/mypage" className="text-xs text-gray-400 underline">
          조건 변경하기
        </Link>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 서브 컴포넌트
// ──────────────────────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <div className="mb-4">
      <Link href="/" className="text-sm text-gray-500">
        ← 홈
      </Link>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 저장 훅 (localStorage)
// ──────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'saved-sellers'

function useSavedSellers() {
  const [saved, setSaved] = useState<Set<number>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSaved(new Set(JSON.parse(raw) as number[]))
    } catch { /* ignore */ }
  }, [])

  const toggle = useCallback((matchId: number) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch { /* ignore */ }
      return next
    })
  }, [])

  return { saved, toggle }
}

function SellerCard({
  seller,
  isSaved,
  onToggleSave,
}: {
  seller: SellerWithScore
  isSaved: boolean
  onToggleSave: (matchId: number) => void
}) {
  const ownershipPercent = Math.round(seller.ownership_rate * 100)
  const hygieneRequired = seller.total_count > 0
  const isFullyCertified = seller.hygiene_cert_rate >= 1.0

  return (
    <li className="border border-gray-200 rounded p-4">
      {/* 저장 버튼 */}
      <div className="flex justify-end mb-1">
        <button
          onClick={() => onToggleSave(seller.match_id)}
          className="text-lg leading-none"
          aria-label={isSaved ? '저장 취소' : '저장'}
        >
          {isSaved ? '♥' : '♡'}
        </button>
      </div>

      {/* 배지 */}
      <div className="flex flex-wrap gap-1 mb-3">
        {seller.already_requested && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded">
            🔄 요청 진행 중
          </span>
        )}
        {seller.is_different_semester && (
          <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded">
            📅 {formatSemester(seller.semester)}
          </span>
        )}
        {hygieneRequired && isFullyCertified && (
          <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded">
            ✅ 세탁완료
          </span>
        )}
        {hygieneRequired && !isFullyCertified && (
          <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-100 px-2 py-0.5 rounded">
            ⚠️ 인증없음
          </span>
        )}
      </div>

      {/* 셀러 정보 */}
      <p className="font-medium text-sm mb-0.5">{seller.seller_name}</p>
      {!seller.is_different_semester && (
        <p className="text-xs text-gray-400 mb-3">{formatSemester(seller.semester)}</p>
      )}

      {/* 보유율 프로그레스 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>보유율</span>
          <span>
            {seller.owned_count}/{seller.total_count} ({ownershipPercent}%)
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-gray-800 rounded-full h-1.5"
            style={{ width: `${ownershipPercent}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      {seller.already_requested && seller.room_id ? (
        <Link
          href={`/chat/${seller.room_id}`}
          className="block text-center px-4 py-2 bg-black text-white text-sm rounded"
        >
          채팅 이어가기 →
        </Link>
      ) : (
        <Link
          href={`/packages/${seller.match_id}`}
          className="block text-center px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
        >
          상세 보기
        </Link>
      )}
    </li>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 개발 미리보기 (미로그인 상태 mock)
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_SELLERS: SellerWithScore[] = [
  {
    match_id: 1,
    seller_uid: 'mock-uid-1',
    seller_name: 'Kim Minjun',
    semester: '2026-1',
    is_different_semester: false,
    owned_count: 7,
    total_count: 9,
    ownership_rate: 7 / 9,
    hygiene_cert_rate: 1.0,
    score: 0.85,
    already_requested: false,
    room_id: null,
  },
  {
    match_id: 2,
    seller_uid: 'mock-uid-2',
    seller_name: 'Emma Müller',
    semester: '2026-1',
    is_different_semester: false,
    owned_count: 5,
    total_count: 9,
    ownership_rate: 5 / 9,
    hygiene_cert_rate: 0.67,
    score: 0.59,
    already_requested: false,
    room_id: null,
  },
  {
    match_id: 3,
    seller_uid: 'mock-uid-3',
    seller_name: 'Lucas Park',
    semester: '2025-2',
    is_different_semester: true,
    owned_count: 9,
    total_count: 9,
    ownership_rate: 1.0,
    hygiene_cert_rate: 1.0,
    score: 1.0,
    already_requested: true,
    room_id: 2,
  },
]

function DevPreview() {
  const { saved, toggle: toggleSave } = useSavedSellers()

  return (
    <div className="p-8">
      <BackLink />
      <div className="border border-yellow-300 bg-yellow-50 rounded p-2 mb-4">
        <p className="text-xs text-yellow-700">개발 미리보기 — 실제 데이터 아님</p>
      </div>
      <h1 className="text-lg font-bold mb-1">패키지 추천</h1>
      <p className="text-sm text-gray-400 mb-4">E3 · 기숙사 · 2026-1학기</p>
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-1">추천 패키지</p>
        <p className="font-semibold">기숙사 기본 패키지</p>
      </div>
      <ul className="flex flex-col gap-3">
        {[...MOCK_SELLERS]
          .sort((a, b) => {
            const aSaved = saved.has(a.match_id) ? 0 : 1
            const bSaved = saved.has(b.match_id) ? 0 : 1
            return aSaved - bSaved
          })
          .map((seller) => (
            <SellerCard
              key={seller.match_id}
              seller={seller}
              isSaved={saved.has(seller.match_id)}
              onToggleSave={toggleSave}
            />
          ))}
      </ul>
    </div>
  )
}
