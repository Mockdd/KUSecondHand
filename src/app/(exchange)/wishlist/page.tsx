'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'

interface WishlistItem {
  exchange_wishlist_id: number
  category_id: number
  category_name: string
  region_group: string
  semester: string
  is_notified: boolean
  notified_at: string | null
  created_at: string
}

export default function WishlistPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { profile, isLoading: profileLoading } = useExchangeProfile()
  const userId = profile?.uid ?? null

  const { data: wishlists = [], isLoading } = useQuery({
    queryKey: ['wishlists', userId],
    queryFn: async (): Promise<WishlistItem[]> => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('exchange_wishlists')
        .select(`
          exchange_wishlist_id,
          category_id,
          region_group,
          semester,
          is_notified,
          notified_at,
          created_at,
          categories (name)
        `)
        .eq('uid', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error || !data) return []
      return data.map((w) => ({
        exchange_wishlist_id: w.exchange_wishlist_id,
        category_id: w.category_id,
        region_group: w.region_group,
        semester: w.semester,
        is_notified: w.is_notified,
        notified_at: w.notified_at,
        created_at: w.created_at,
        category_name:
          (Array.isArray(w.categories)
            ? (w.categories[0] as { name: string } | undefined)?.name
            : (w.categories as { name: string } | null)?.name) ?? '알 수 없음',
      }))
    },
    enabled: !!userId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (wishlistId: number) => {
      const { error } = await supabase
        .from('exchange_wishlists')
        .update({ deleted_at: new Date().toISOString() })
        .eq('exchange_wishlist_id', wishlistId)
        .eq('uid', userId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlists', userId] })
    },
  })

  if (profileLoading || isLoading) {
    return <div className="p-8"><p className="text-gray-500">로딩 중...</p></div>
  }

  const displayList: WishlistItem[] = !userId
    ? MOCK_WISHLISTS
    : wishlists

  return (
    <div className="p-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/" className="text-gray-400 text-sm">←</Link>
        <h1 className="text-xl font-bold">알림 신청 목록</h1>
      </div>

      {!userId && (
        <div className="border border-yellow-300 bg-yellow-50 rounded p-2 mb-4">
          <p className="text-xs text-yellow-700">개발 미리보기 — 실제 데이터 아님</p>
        </div>
      )}

      {displayList.length === 0 && userId ? (
        <div>
          <p className="text-sm text-gray-400 mb-4">알림 신청한 물품이 없어요.</p>
          <Link href="/packages" className="text-sm underline text-gray-600">
            패키지 추천 보기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayList.map((w) => (
            <div
              key={w.exchange_wishlist_id}
              className="border border-gray-200 rounded p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">{w.category_name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {w.region_group} · {w.semester}
                </p>
                <p className="text-xs mt-1">
                  {w.is_notified ? (
                    <span className="text-green-600">알림 발송됨 ✅</span>
                  ) : (
                    <span className="text-gray-400">대기 중 🔔</span>
                  )}
                </p>
              </div>
              {!w.is_notified && userId && (
                <button
                  onClick={() => deleteMutation.mutate(w.exchange_wishlist_id)}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-1 hover:border-gray-400 disabled:opacity-40"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const MOCK_WISHLISTS: WishlistItem[] = [
  { exchange_wishlist_id: 1, category_id: 17, category_name: '청소기',      region_group: 'E3', semester: '2026-1', is_notified: false, notified_at: null, created_at: '' },
  { exchange_wishlist_id: 2, category_id: 18, category_name: '빨래 건조대', region_group: 'E3', semester: '2026-1', is_notified: true,  notified_at: '2026-05-01T10:00:00Z', created_at: '' },
]
