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
  compareSellerScore,
} from '@/lib/utils/score'
import { formatSemester } from '@/lib/utils/format'
import type { PackageFallbackResult, SellerWithScore } from '@/types/package'

interface RawPackageListing {
  listing_id: number
  category_id: number
  status: string
}

interface RawMatch {
  match_id: number
  seller_uid: string
  semester: string | null
  status: string
  price: number | null
  package_listings: RawPackageListing[]
}

interface SellerQueryResult {
  sellers: SellerWithScore[]
  is_different_semester: boolean
}

async function fetchSellersWithScore(
  supabase: ReturnType<typeof createClient>,
  packageId: number,
  userSemester: string,
  userId: string
): Promise<SellerQueryResult> {
  const { data: packageItems, error: itemsError } = await supabase
    .from('package_items')
    .select('category_id')
    .eq('package_id', packageId)

  if (itemsError) throw new Error('패키지 정보를 불러올 수 없어요')

  const totalCount = packageItems?.length ?? 0

  const fetchMatches = async (sameSemester: boolean) => {
    let query = supabase
      .from('package_matches')
      .select(`
        match_id,
        seller_uid,
        semester,
        status,
        price,
        package_listings (
          listing_id,
          category_id,
          status
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

  const { data: sameSemData, error: sameErr } = await fetchMatches(true)
  if (sameErr) throw new Error('셀러 목록을 불러올 수 없어요')

  let rawMatches = (sameSemData ?? []) as RawMatch[]
  let isDifferentSemester = false

  if (rawMatches.length === 0) {
    const { data: diffSemData, error: diffErr } = await fetchMatches(false)
    if (diffErr) throw new Error('셀러 목록을 불러올 수 없어요')
    rawMatches = (diffSemData ?? []) as RawMatch[]
    isDifferentSemester = rawMatches.length > 0
  }

  if (rawMatches.length === 0) return { sellers: [], is_different_semester: false }

  const sellerUids = [...new Set(rawMatches.map((m) => m.seller_uid))]

  const { data: usersData } = await supabase
    .from('users')
    .select('uid, nickname')
    .in('uid', sellerUids)

  const nicknameMap = new Map<string, string>(
    (usersData ?? []).map((u) => [u.uid, u.nickname])
  )

  const { data: myRequests } = await supabase
    .from('package_matches')
    .select('match_id, seller_uid, chat_rooms(room_id)')
    .eq('package_id', packageId)
    .eq('buyer_uid', userId)
    .in('status', ['pending', 'matched'])

  const requestedSellerUids = new Set((myRequests ?? []).map((r) => r.seller_uid))

  const sellerRoomMap = new Map<string, number>()
  ;(myRequests ?? []).forEach((r) => {
    const room = Array.isArray(r.chat_rooms) ? r.chat_rooms[0] : r.chat_rooms
    const roomId = (room as { room_id: number } | null)?.room_id
    if (roomId) sellerRoomMap.set(r.seller_uid, roomId)
  })

  const sellers: SellerWithScore[] = rawMatches.map((match) => {
    const listings = match.package_listings ?? []
    const ownedCount = listings.filter((l) => l.status === 'selling').length

    return {
      match_id: match.match_id,
      seller_uid: match.seller_uid,
      seller_name: nicknameMap.get(match.seller_uid) ?? '알 수 없음',
      semester: match.semester ?? '',
      is_different_semester: isDifferentSemester,
      owned_count: ownedCount,
      total_count: totalCount,
      ownership_rate: calculateOwnershipRate(ownedCount, totalCount),
      score: calculateSellerScore(ownedCount, totalCount),
      price: match.price,
      already_requested: requestedSellerUids.has(match.seller_uid),
      room_id: sellerRoomMap.get(match.seller_uid) ?? null,
    }
  })

  sellers.sort(compareSellerScore)
  return { sellers: sellers.slice(0, 5), is_different_semester: isDifferentSemester }
}

// ─── 저장 훅 ─────────────────────────────────────────────────────────────────

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
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { saved, toggle }
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const supabase = createClient()
  const { profile, isLoading: profileLoading, error: profileError } = useExchangeProfile()
  const { saved, toggle: toggleSave } = useSavedSellers()

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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('NOT_AUTHENTICATED')
      return fetchSellersWithScore(supabase, packageId!, profile!.semester!, user.id)
    },
  })

  // 미로그인 또는 교환학생 프로필 없음
  if (!profileLoading && !profile) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-600 mb-2">교환학생 프로필이 필요합니다.</p>
        <p className="text-sm text-gray-400 mb-4">마이페이지에서 교환학생 정보를 등록하면 맞춤 패키지를 확인할 수 있어요.</p>
        <Link href="/my/profile" className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          마이페이지로 이동
        </Link>
      </div>
    )
  }

  if (profileLoading || packageLoading || sellersLoading) {
    return <p className="text-sm text-gray-400">불러오는 중...</p>
  }

  if (profileError) {
    return <p className="text-sm text-red-500">{profileError}</p>
  }

  if (packageError || sellersError) {
    const msg =
      packageError instanceof Error ? packageError.message :
      sellersError instanceof Error ? sellersError.message :
      '알 수 없는 오류'
    return (
      <div>
        <p className="text-sm text-red-500 mb-3">{msg}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (!pkg || fallbackResult?.tier === 0) {
    return (
      <div>
        <p className="text-sm text-gray-600 mb-4">현재 조건에 맞는 패키지가 없어요.</p>
        <Link href="/wishlist" className="inline-block rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          알림 신청하기
        </Link>
      </div>
    )
  }

  const sellers = sellerResult?.sellers ?? []
  const fallbackMessage = getFallbackMessage(
    fallbackResult.tier,
    fallbackResult.label,
    pkg.region_group ?? undefined
  )

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">패키지 추천</h1>
        <p className="mt-1 text-sm text-gray-500">
          {profile?.region_group} · {profile?.housing_type === 'dorm' ? '기숙사' : '자취'} · {profile?.semester ? formatSemester(profile.semester) : ''}
        </p>
      </div>

      {/* 추천 패키지명 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs text-gray-400 mb-1">추천 패키지</p>
        <p className="text-lg font-semibold text-gray-900">{pkg.name_ko}</p>
        {pkg.name_en && <p className="text-sm text-gray-400">{pkg.name_en}</p>}
      </div>

      {/* Fallback / 다른학기 안내 */}
      {fallbackMessage && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">{fallbackMessage}</p>
        </div>
      )}
      {sellerResult?.is_different_semester && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">같은 학기 셀러가 없어 다른 학기 매물을 표시해요.</p>
        </div>
      )}

      {/* 셀러 목록 */}
      {sellers.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">현재 등록된 셀러가 없어요.</p>
          <Link href="/wishlist" className="inline-block rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            알림 신청하기
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...sellers]
            .sort((a, b) => (saved.has(a.match_id) ? 0 : 1) - (saved.has(b.match_id) ? 0 : 1))
            .map((seller) => (
              <SellerCard
                key={seller.match_id}
                seller={seller}
                isSaved={saved.has(seller.match_id)}
                onToggleSave={toggleSave}
              />
            ))}
        </div>
      )}

      {/* 조건 변경 */}
      <div className="pt-4 border-t border-gray-100 flex justify-end">
        <Link href="/my/profile" className="text-xs text-gray-400 hover:text-gray-600">
          조건 변경하기
        </Link>
      </div>
    </div>
  )
}

// ─── SellerCard ───────────────────────────────────────────────────────────────

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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3">
      {/* 상단: 이름 + 저장 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-900">{seller.seller_name}</p>
          {!seller.is_different_semester && (
            <p className="text-xs text-gray-400">{formatSemester(seller.semester)}</p>
          )}
        </div>
        <button
          onClick={() => onToggleSave(seller.match_id)}
          className="text-lg text-gray-400 hover:text-red-400 transition-colors"
          aria-label={isSaved ? '저장 취소' : '저장'}
        >
          {isSaved ? '♥' : '♡'}
        </button>
      </div>

      {/* 배지 */}
      <div className="flex flex-wrap gap-1">
        {seller.already_requested && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
            요청 진행 중
          </span>
        )}
        {seller.is_different_semester && (
          <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">
            {formatSemester(seller.semester)}
          </span>
        )}
      </div>

      {/* 가격 */}
      {seller.price != null && (
        <p className="text-base font-semibold text-gray-900">
          {seller.price.toLocaleString()}원
        </p>
      )}

      {/* 보유율 */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>보유율</span>
          <span>{seller.owned_count}/{seller.total_count} ({ownershipPercent}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-indigo-500 rounded-full h-1.5 transition-all"
            style={{ width: `${ownershipPercent}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      {seller.already_requested && seller.room_id ? (
        <Link
          href={`/chat/${seller.room_id}`}
          className="block text-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          채팅 이어가기
        </Link>
      ) : (
        <Link
          href={`/packages/${seller.match_id}`}
          className="block text-center rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          상세 보기
        </Link>
      )}
    </div>
  )
}
