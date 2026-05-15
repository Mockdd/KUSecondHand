'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'
import { formatSemester } from '@/lib/utils/format'

// ──────────────────────────────────────────────────────────────────────────────
// 로컬 타입
// ──────────────────────────────────────────────────────────────────────────────

interface MatchBase {
  match_id: number
  package_id: number
  seller_uid: string
  status: string
  semester: string | null
  price: number | null
}

interface CategoryItem {
  category_id: number
  category_name: string
  is_required: boolean
  priority_order: number
}

interface ListingItem {
  listing_id: number
  category_id: number
  status: string
}

interface BuyerRequest {
  match_id: number
  buyer_uid: string
  status: string
  room_id: number | null
}

interface SellerUser {
  uid: string
  nickname: string
  manner_temperature: number
}

// ──────────────────────────────────────────────────────────────────────────────
// BuyerView
// ──────────────────────────────────────────────────────────────────────────────

interface BuyerViewProps {
  matchId: number
  packageId: number
  sellerUid: string
  userId: string
  userSemester: string
  userRegionGroup: string
}

function BuyerView({ matchId, packageId, sellerUid, userId, userSemester, userRegionGroup }: BuyerViewProps) {
  const supabase = createClient()
  const router = useRouter()

  // ── 패키지 구성 물품 + 카테고리명 ──────────────────────────────────────────
  const { data: items = [], isLoading: itemsLoading } = useQuery<CategoryItem[]>({
    queryKey: ['package-items', packageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_items')
        .select('category_id, is_required, priority_order, categories(name)')
        .eq('package_id', packageId)
        .order('priority_order')

      if (error) throw new Error('패키지 물품을 불러올 수 없어요')

      return (data ?? []).map((row) => {
        const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories
        return {
          category_id: row.category_id,
          category_name: (cat as { name: string } | null)?.name ?? '알 수 없음',
          is_required: row.is_required,
          priority_order: row.priority_order,
        }
      })
    },
  })

  // ── 셀러가 보유한 물품 목록 ────────────────────────────────────────────────
  const { data: listings = [], isLoading: listingsLoading } = useQuery<ListingItem[]>({
    queryKey: ['package-listings', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_listings')
        .select('listing_id, category_id, status')
        .eq('match_id', matchId)
        .eq('seller_uid', sellerUid)

      if (error) throw new Error('셀러 매물을 불러올 수 없어요')
      return (data ?? []) as ListingItem[]
    },
  })

  // ── 셀러 유저 정보 ─────────────────────────────────────────────────────────
  const { data: sellerUser } = useQuery<SellerUser | null>({
    queryKey: ['user-info', sellerUid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('uid, nickname, manner_temperature')
        .eq('uid', sellerUid)
        .single()

      if (error) return null
      return data as SellerUser
    },
  })

  // ── 바이어의 기존 거래 요청 확인 ──────────────────────────────────────────
  const { data: existingRequest, refetch: refetchRequest } = useQuery<BuyerRequest | null>({
    queryKey: ['buyer-request', userId, sellerUid, packageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_matches')
        .select('match_id, buyer_uid, status, chat_rooms(room_id)')
        .eq('buyer_uid', userId)
        .eq('seller_uid', sellerUid)
        .eq('package_id', packageId)
        .neq('status', 'cancelled')
        .maybeSingle()

      if (error) throw new Error('거래 요청 정보를 불러올 수 없어요')
      if (!data) return null

      const room = Array.isArray(data.chat_rooms)
        ? data.chat_rooms[0]
        : data.chat_rooms

      return {
        match_id: data.match_id,
        buyer_uid: data.buyer_uid,
        status: data.status,
        room_id: (room as { room_id: number } | null)?.room_id ?? null,
      }
    },
  })

  // ── 거래 요청 Mutation ────────────────────────────────────────────────────
  const [tradeError, setTradeError] = React.useState<string | null>(null)

  const tradeMutation = useMutation({
    mutationFn: async () => {
      // 1. package_matches 생성 (바이어 요청)
      const { data: newMatch, error: matchError } = await supabase
        .from('package_matches')
        .insert({
          package_id: packageId,
          buyer_uid: userId,
          seller_uid: sellerUid,
          status: 'pending',
          semester: userSemester,
        })
        .select('match_id')
        .single()

      if (matchError) {
        if (matchError.code === '23505') throw new Error('이미 요청한 패키지예요')
        if (matchError.code === '42501') throw new Error('본인 패키지에는 요청할 수 없어요')
        throw new Error('거래 요청에 실패했어요')
      }

      const newMatchId = newMatch.match_id

      // 2. chat_rooms 생성
      const { data: chatRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({ package_match_id: newMatchId })
        .select('room_id')
        .single()

      if (roomError) throw new Error('채팅방 생성에 실패했어요')

      const roomId = chatRoom.room_id

      // 3. chat_participants 생성 (바이어 + 셀러)
      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert([
          { room_id: roomId, uid: userId },
          { room_id: roomId, uid: sellerUid },
        ])

      if (participantsError) throw new Error('채팅 참여자 등록에 실패했어요')

      return { roomId }
    },
    onSuccess: ({ roomId }) => {
      router.push(`/chat/${roomId}`)
    },
    onError: (err: Error) => {
      setTradeError(err.message)
    },
  })

  const ownedCategoryIds = new Set(listings.map((l) => l.category_id))
  const isLoading = itemsLoading || listingsLoading

  if (isLoading) {
    return <p className="text-gray-500 text-sm">불러오는 중...</p>
  }

  return (
    <div>
      {/* 셀러 정보 */}
      <div className="border border-gray-200 rounded p-4 mb-6 text-sm">
        <p className="font-medium mb-1">{sellerUser?.nickname ?? '알 수 없음'}</p>
        <p className="text-gray-500 text-xs mt-1">
          보유 물품: {listings.length} / {items.length}개
        </p>
      </div>

      {/* 물품 목록 */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">물품 목록</h2>
      <div className="flex flex-col gap-2 mb-6">
        {items.map((item) => {
          const isOwned = ownedCategoryIds.has(item.category_id)

          return (
            <div
              key={item.category_id}
              className="border border-gray-200 rounded p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span>{item.category_name}</span>
                <div className="flex gap-1">
                  {item.is_required && (
                    <span className="text-xs border border-gray-400 px-1 rounded">필수</span>
                  )}
                  {isOwned ? (
                    <span className="text-xs border border-green-500 text-green-700 px-1 rounded">
                      보유
                    </span>
                  ) : (
                    <span className="text-xs border border-red-400 text-red-600 px-1 rounded">
                      미보유
                    </span>
                  )}
                </div>
              </div>

              {/* 미보유 물품 — 보완 매물 */}
              {!isOwned && (
                <SupplementSection
                  categoryId={item.category_id}
                  categoryName={item.category_name}
                  userId={userId}
                  userRegionGroup={userRegionGroup}
                  userSemester={userSemester}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* 거래 요청 */}
      {existingRequest ? (
        <div className="border border-gray-200 rounded p-4 text-sm">
          <p className="text-gray-600 mb-2">
            거래 요청 상태:{' '}
            <span className="font-medium">{existingRequest.status}</span>
          </p>
          {existingRequest.room_id && (
            <Link
              href={`/chat/${existingRequest.room_id}`}
              className="inline-block px-4 py-2 bg-black text-white text-sm rounded"
            >
              채팅방 이동
            </Link>
          )}
        </div>
      ) : (
        <div>
          {tradeError && (
            <p className="text-red-600 text-sm mb-2">{tradeError}</p>
          )}
          <button
            onClick={() => {
              setTradeError(null)
              tradeMutation.mutate()
            }}
            disabled={tradeMutation.isPending}
            className="w-full px-4 py-3 bg-black text-white text-sm rounded disabled:opacity-50"
          >
            {tradeMutation.isPending ? '요청 중...' : '거래 요청하기'}
          </button>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 보완 매물 섹션 (미보유 물품에 표시)
// ──────────────────────────────────────────────────────────────────────────────

interface SupplementSectionProps {
  categoryId: number
  categoryName: string
  userId: string
  userRegionGroup: string
  userSemester: string
}

function SupplementSection({ categoryId, categoryName, userId, userRegionGroup, userSemester }: SupplementSectionProps) {
  const supabase = createClient()

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['supplement-products', categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('pid, title, price, condition, seller_name:users(nickname), product_images(image_url, display_order)')
        .eq('category_id', categoryId)
        .eq('status', 'selling')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(3)

      if (error) return []
      return (data ?? []).map((p) => {
        const sellerNickname =
          Array.isArray(p.seller_name)
            ? (p.seller_name[0] as { nickname: string } | undefined)?.nickname
            : (p.seller_name as { nickname: string } | null)?.nickname
        const images = Array.isArray(p.product_images)
          ? (p.product_images as { image_url: string; display_order: number }[])
              .filter((img) => img.display_order === 0)
          : []
        return {
          pid: p.pid,
          title: p.title,
          price: p.price,
          condition: p.condition,
          seller_name: sellerNickname ?? '알 수 없음',
          thumbnail: images[0]?.image_url ?? null,
        }
      })
    },
  })

  const { data: wishlistEntry, refetch: refetchWishlist } = useQuery({
    queryKey: ['wishlist', userId, categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from('exchange_wishlists')
        .select('exchange_wishlist_id, deleted_at')
        .eq('uid', userId)
        .eq('category_id', categoryId)
        .maybeSingle()
      return data
    },
  })

  const [wishlistError, setWishlistError] = React.useState<string | null>(null)

  const wishlistMutation = useMutation({
    mutationFn: async () => {
      const isActive = wishlistEntry && !wishlistEntry.deleted_at

      if (isActive) {
        // 소프트 삭제
        const { error } = await supabase
          .from('exchange_wishlists')
          .update({ deleted_at: new Date().toISOString() })
          .eq('exchange_wishlist_id', wishlistEntry.exchange_wishlist_id)
        if (error) throw error
      } else if (wishlistEntry) {
        // 복구
        const { error } = await supabase
          .from('exchange_wishlists')
          .update({ deleted_at: null })
          .eq('exchange_wishlist_id', wishlistEntry.exchange_wishlist_id)
        if (error) throw error
      } else {
        // 신규 등록 — region_group, semester 필수
        if (!userRegionGroup || !userSemester) throw new Error('프로필 정보가 부족해요 (지역/학기 미설정)')
        const { error } = await supabase
          .from('exchange_wishlists')
          .insert({
            uid: userId,
            category_id: categoryId,
            region_group: userRegionGroup,
            semester: userSemester,
          })
        if (error) {
          if (error.code === '23505') return // 이미 등록됨 — 정상 처리
          throw error
        }
      }
    },
    onSuccess: () => {
      setWishlistError(null)
      refetchWishlist()
    },
    onError: () => setWishlistError('알림 신청 중 오류가 발생했어요.'),
  })

  const isWishlisted = !!wishlistEntry && !wishlistEntry.deleted_at

  if (isLoading) return null

  return (
    <div className="mt-2 pt-2 border-t border-gray-100">
      {products.length > 0 ? (
        <div>
          <p className="text-xs text-gray-500 mb-1">일반 매물</p>
          <div className="flex flex-col gap-2">
            {products.map((p) => (
              <div key={p.pid} className="flex items-center justify-between text-xs text-gray-600 gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="truncate font-medium text-gray-800">{p.title}</span>
                  <span className="text-gray-400">{p.seller_name} · {p.price.toLocaleString()}원</span>
                </div>
                <Link
                  href={`/products/${p.pid}`}
                  className="shrink-0 px-2 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50"
                >
                  보러가기
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-400">
            &apos;{categoryName}&apos; 매물이 없어요.{' '}
            <button
              onClick={() => wishlistMutation.mutate()}
              disabled={wishlistMutation.isPending}
              className="underline text-gray-500"
            >
              {isWishlisted ? '알림 신청 취소' : '알림 신청하기'}
            </button>
          </p>
          {wishlistError && (
            <p className="text-xs text-red-500 mt-1">{wishlistError}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// SellerView
// ──────────────────────────────────────────────────────────────────────────────

interface SellerViewProps {
  matchId: number
  packageId: number
  userId: string
}

function SellerView({ matchId, packageId, userId }: SellerViewProps) {
  const supabase = createClient()
  const router = useRouter()

  // ── 패키지 구성 물품 ──────────────────────────────────────────────────────
  const { data: items = [], isLoading: itemsLoading } = useQuery<CategoryItem[]>({
    queryKey: ['package-items', packageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_items')
        .select('category_id, is_required, priority_order, categories(name)')
        .eq('package_id', packageId)
        .order('priority_order')

      if (error) throw new Error('패키지 물품을 불러올 수 없어요')

      return (data ?? []).map((row) => {
        const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories
        return {
          category_id: row.category_id,
          category_name: (cat as { name: string } | null)?.name ?? '알 수 없음',
          is_required: row.is_required,
          priority_order: row.priority_order,
        }
      })
    },
  })

  // ── 내 보유 물품 목록 ──────────────────────────────────────────────────────
  const { data: myListings = [], isLoading: listingsLoading } = useQuery<ListingItem[]>({
    queryKey: ['package-listings', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_listings')
        .select('listing_id, category_id, status')
        .eq('match_id', matchId)
        .eq('seller_uid', userId)

      if (error) throw new Error('내 매물을 불러올 수 없어요')
      return (data ?? []) as ListingItem[]
    },
  })

  // ── 바이어 거래 요청 목록 ──────────────────────────────────────────────────
  const { data: buyerRequests = [], isLoading: buyersLoading } = useQuery<
    Array<{
      match_id: number
      buyer_uid: string
      buyer_name: string
      status: string
      room_id: number | null
    }>
  >({
    queryKey: ['buyer-requests', packageId, userId],
    queryFn: async () => {
      // 바이어 요청 조회 (buyer_uid IS NOT NULL, seller_uid = me)
      const { data: matches, error: matchesError } = await supabase
        .from('package_matches')
        .select('match_id, buyer_uid, status')
        .eq('package_id', packageId)
        .eq('seller_uid', userId)
        .not('buyer_uid', 'is', null)
        .neq('status', 'cancelled')

      if (matchesError) throw new Error('거래 요청 목록을 불러올 수 없어요')
      if (!matches || matches.length === 0) return []

      const matchIds = matches.map((m) => m.match_id)
      const buyerUids = matches.map((m) => m.buyer_uid).filter(Boolean) as string[]

      // 바이어 이름 조회
      const { data: buyerUsers } = await supabase
        .from('users')
        .select('uid, nickname')
        .in('uid', buyerUids)

      const nicknameMap = new Map(
        (buyerUsers ?? []).map((u) => [u.uid, u.nickname])
      )

      // 채팅방 조회
      const { data: chatRooms } = await supabase
        .from('chat_rooms')
        .select('room_id, package_match_id')
        .in('package_match_id', matchIds)

      const roomMap = new Map(
        (chatRooms ?? []).map((r) => [r.package_match_id, r.room_id])
      )

      return matches.map((m) => ({
        match_id: m.match_id,
        buyer_uid: m.buyer_uid as string,
        buyer_name: nicknameMap.get(m.buyer_uid as string) ?? '알 수 없음',
        status: m.status,
        room_id: roomMap.get(m.match_id) ?? null,
      }))
    },
  })

  // ── 등록 취소 (바이어 없을 때만) ──────────────────────────────────────────
  const [cancelError, setCancelError] = React.useState<string | null>(null)

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('package_matches')
        .update({ status: 'cancelled' })
        .eq('match_id', matchId)
        .eq('seller_uid', userId)
        .is('buyer_uid', null)
      if (error) throw new Error('등록 취소에 실패했어요')
    },
    onSuccess: () => {
      router.push('/packages')
    },
    onError: (err: Error) => {
      setCancelError(err.message)
    },
  })

  const ownedCategoryIds = new Set(myListings.map((l) => l.category_id))
  const isLoading = itemsLoading || listingsLoading || buyersLoading
  const hasBuyers = buyerRequests.length > 0

  if (isLoading) {
    return <p className="text-gray-500 text-sm">불러오는 중...</p>
  }

  return (
    <div>
      {/* 내 물품 목록 */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">내 물품 현황</h2>
      <div className="flex flex-col gap-2 mb-6">
        {items.map((item) => {
          const isOwned = ownedCategoryIds.has(item.category_id)

          return (
            <div
              key={item.category_id}
              className="border border-gray-200 rounded p-3 text-sm flex items-center justify-between"
            >
              <span>{item.category_name}</span>
              <div className="flex gap-1">
                {item.is_required && (
                  <span className="text-xs border border-gray-400 px-1 rounded">필수</span>
                )}
                {isOwned ? (
                  <span className="text-xs border border-green-500 text-green-700 px-1 rounded">
                    보유
                  </span>
                ) : (
                  <span className="text-xs border border-red-400 text-red-600 px-1 rounded">
                    미보유
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 바이어 요청 목록 */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
        거래 요청 ({buyerRequests.length})
      </h2>
      {buyerRequests.length === 0 ? (
        <p className="text-gray-400 text-sm">아직 거래 요청이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {buyerRequests.map((req) => (
            <div key={req.match_id} className="border border-gray-200 rounded p-3 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{req.buyer_name}</span>
                <span className="text-xs text-gray-500">{req.status}</span>
              </div>
              {req.room_id && (
                <Link
                  href={`/chat/${req.room_id}`}
                  className="text-xs underline text-gray-600"
                >
                  채팅방 이동
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 등록 취소 */}
      {!hasBuyers && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          {cancelError && <p className="text-sm text-red-500 mb-2">{cancelError}</p>}
          <button
            onClick={() => {
              setCancelError(null)
              cancelMutation.mutate()
            }}
            disabled={cancelMutation.isPending}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {cancelMutation.isPending ? '취소 중...' : '등록 취소하기'}
          </button>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// React import (useState 사용을 위해)
// ──────────────────────────────────────────────────────────────────────────────

import React from 'react'

// ──────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────────────────────────────────────

export default function PackageDetailPage() {
  const params = useParams<{ id: string }>()
  const matchId = Number(params.id)
  const supabase = createClient()
  const { profile, isLoading: profileLoading } = useExchangeProfile()

  const userId = profile?.uid ?? ''

  // ── 기준 매칭 조회 (패키지 ID, 셀러 UID 확인용) ───────────────────────────
  const {
    data: matchBase,
    isLoading: matchLoading,
    error: matchError,
  } = useQuery<MatchBase | null>({
    queryKey: ['package-match-base', matchId],
    enabled: !!profile && !isNaN(matchId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('package_matches')
        .select('match_id, package_id, seller_uid, status, semester, price')
        .eq('match_id', matchId)
        .single()

      if (error) throw new Error('패키지 정보를 불러올 수 없어요')
      return data as MatchBase
    },
  })

  // ── 패키지 이름 조회 ───────────────────────────────────────────────────────
  const { data: packageInfo } = useQuery<{ name_ko: string; name_en: string } | null>({
    queryKey: ['package-info', matchBase?.package_id],
    enabled: !!matchBase?.package_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('essential_packages')
        .select('name_ko, name_en')
        .eq('package_id', matchBase!.package_id)
        .single()

      if (error) return null
      return data as { name_ko: string; name_en: string }
    },
  })

  // ── 로딩 / 에러 ─────────────────────────────────────────────────────────
  if (profileLoading || matchLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-500">불러오는 중...</p>
      </div>
    )
  }

  if (matchError || !matchBase) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">패키지를 찾을 수 없어요.</p>
        <Link href="/packages" className="text-sm underline text-gray-600 mt-2 inline-block">
          목록으로
        </Link>
      </div>
    )
  }

  const isSeller = matchBase.seller_uid === userId
  const packageName = packageInfo?.name_ko ?? '패키지'
  const semesterLabel = matchBase.semester ? formatSemester(matchBase.semester) : null
  const priceLabel = matchBase.price != null ? `${matchBase.price.toLocaleString()}원` : null

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/packages" className="text-sm text-gray-500 underline shrink-0">
          ← 목록
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{packageName}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {semesterLabel && (
              <p className="text-xs text-gray-500">{semesterLabel}</p>
            )}
            {priceLabel && (
              <p className="text-base font-semibold text-gray-900">{priceLabel}</p>
            )}
          </div>
        </div>
      </div>

      {/* 역할별 뷰 */}
      {isSeller ? (
        <SellerView
          matchId={matchId}
          packageId={matchBase.package_id}
          userId={userId}
        />
      ) : (
        <BuyerView
          matchId={matchId}
          packageId={matchBase.package_id}
          sellerUid={matchBase.seller_uid}
          userId={userId}
          userSemester={profile?.semester ?? ''}
          userRegionGroup={profile?.region_group ?? ''}
        />
      )}
    </div>
  )
}
