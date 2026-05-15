'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { formatCondition } from '@/lib/utils/format'
import { createClient } from '@/lib/supabase/client'

// ─── 상품 위시리스트 ───────────────────────────────────────────────

interface ProductImage {
  image_url: string
  display_order: number
}

interface ProductWishlistItem {
  wishlist_id: number
  pid: string
  created_at: string
  products: {
    pid: string
    title: string
    price: number
    condition: string
    product_images: ProductImage[] | null
  } | null
}

function ProductWishlist({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  const { data: wishlists = [], isLoading } = useQuery({
    queryKey: ['product-wishlists', userId],
    queryFn: async (): Promise<ProductWishlistItem[]> => {
      const res = await fetch('/api/wishlists')
      if (!res.ok) return []
      const json = await res.json()
      return json.wishlists ?? []
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (pid: string) => {
      const res = await fetch(`/api/wishlists/${pid}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('삭제 실패')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-wishlists', userId] })
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">불러오는 중...</p>

  if (wishlists.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500 mb-3">찜한 상품이 없어요.</p>
        <Link href="/products" className="text-sm text-indigo-600 hover:text-indigo-500">
          상품 목록 보기 →
        </Link>
      </div>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {wishlists.map((w) => {
        const product = w.products
        if (!product) return null
        const thumb = [...(product.product_images ?? [])].sort(
          (a, b) => a.display_order - b.display_order,
        )[0]

        return (
          <li key={w.wishlist_id} className="relative">
            <Link
              href={`/products/${product.pid}`}
              className="block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] bg-gray-100">
                {thumb?.image_url ? (
                  <Image
                    src={thumb.image_url}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                    이미지 없음
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 font-medium text-gray-900">{product.title}</p>
                <p className="text-sm text-gray-500">
                  {product.price.toLocaleString()}원 · {formatCondition(product.condition)}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(product.pid)}
              disabled={deleteMutation.isPending}
              className="absolute right-2 top-2 z-10 rounded-lg border border-white/80 bg-white/90 px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-white disabled:opacity-40"
            >
              찜 해제
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── 패키지 위시리스트 (기존 exchange_wishlists) ─────────────────────

interface ExchangeWishlistItem {
  exchange_wishlist_id: number
  category_id: number
  category_name: string
  region_group: string
  semester: string
  is_notified: boolean
  notified_at: string | null
  created_at: string
}

function PackageWishlist({ userId }: { userId: string }) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: wishlists = [], isLoading } = useQuery({
    queryKey: ['exchange-wishlists', userId],
    queryFn: async (): Promise<ExchangeWishlistItem[]> => {
      const { data, error } = await supabase
        .from('exchange_wishlists')
        .select(
          'exchange_wishlist_id, category_id, region_group, semester, is_notified, notified_at, created_at, categories(name)',
        )
        .eq('uid', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error || !data) return []
      return data.map((row) => ({
        exchange_wishlist_id: row.exchange_wishlist_id,
        category_id: row.category_id,
        region_group: row.region_group,
        semester: row.semester,
        is_notified: row.is_notified,
        notified_at: row.notified_at,
        created_at: row.created_at,
        category_name:
          (Array.isArray(row.categories)
            ? (row.categories[0] as { name: string } | undefined)?.name
            : (row.categories as { name: string } | null)?.name) ?? '알 수 없음',
      }))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (wishlistId: number) => {
      const { error } = await supabase
        .from('exchange_wishlists')
        .update({ deleted_at: new Date().toISOString() })
        .eq('exchange_wishlist_id', wishlistId)
        .eq('uid', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-wishlists', userId] })
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">불러오는 중...</p>

  if (wishlists.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500 mb-3">알림 신청한 물품이 없어요.</p>
        <Link href="/packages" className="text-sm text-indigo-600 hover:text-indigo-500">
          패키지 추천 보기 →
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {wishlists.map((w) => (
        <div
          key={w.exchange_wishlist_id}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
            <span className="text-2xl">📦</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-gray-900">{w.category_name}</p>
            <p className="mt-0.5 text-sm text-gray-500">
              {w.region_group} · {w.semester}
            </p>
            <p className="mt-1 text-xs">
              {w.is_notified ? (
                <span className="text-green-600">알림 발송됨</span>
              ) : (
                <span className="text-gray-400">대기 중</span>
              )}
            </p>
          </div>
          {!w.is_notified && (
            <button
              type="button"
              onClick={() => deleteMutation.mutate(w.exchange_wishlist_id)}
              disabled={deleteMutation.isPending}
              className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700 disabled:opacity-40"
            >
              삭제
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────

type Tab = 'products' | 'packages'

function WishlistPageContent() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('products')

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'packages') setActiveTab('packages')
    else setActiveTab('products')
  }, [searchParams])

  const { data: userId, isLoading: authLoading } = useQuery({
    queryKey: ['wishlist-page-auth'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      return user?.id ?? null
    },
  })

  if (authLoading) {
    return <p className="text-sm text-gray-400">불러오는 중...</p>
  }

  if (!userId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="mb-4 text-gray-600">로그인 후 위시리스트를 확인할 수 있어요.</p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          로그인
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">위시리스트</h1>

      <div className="flex w-fit gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'products'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          상품
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('packages')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'packages'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          패키지 알림
        </button>
      </div>

      {activeTab === 'products' ? (
        <ProductWishlist userId={userId} />
      ) : (
        <PackageWishlist userId={userId} />
      )}
    </div>
  )
}

export default function WishlistPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">불러오는 중...</p>}>
      <WishlistPageContent />
    </Suspense>
  )
}
