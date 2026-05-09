'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@lib/supabase/client'
import { getCategoryById } from '@lib/queries/categories'
import { listProductsByCategory } from '@lib/queries/products'
import type {
  CategorySummary,
  ProductListItem,
  ProductSort,
} from '@lib/queries/types'
import { formatPrice } from '@lib/format'

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'recommended', label: '추천순' },
  { value: 'price_asc', label: '가격 낮은순' },
  { value: 'latest', label: '최신순' },
]

const VALID_SORTS = new Set<ProductSort>([
  'recommended',
  'price_asc',
  'latest',
])

function parseSort(raw: string | null): ProductSort {
  if (raw && VALID_SORTS.has(raw as ProductSort)) {
    return raw as ProductSort
  }
  return 'recommended'
}

function parseCategoryId(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto p-4">
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      }
    >
      <ProductsView />
    </Suspense>
  )
}

function ProductsView() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const categoryId = parseCategoryId(searchParams.get('category'))
  const sort = parseSort(searchParams.get('sort'))

  const [authChecked, setAuthChecked] = useState(false)
  const [category, setCategory] = useState<CategorySummary | null>(null)
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 1) 마운트 시 1회: 인증 체크
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        router.replace('/dev/login')
        return
      }
      setAuthChecked(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2) categoryId / sort 변경 시: 카테고리 + 매물 재조회
  useEffect(() => {
    if (!authChecked) return
    if (categoryId === null) {
      setLoading(false)
      setCategory(null)
      setProducts([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const [cat, list] = await Promise.all([
          getCategoryById(categoryId),
          listProductsByCategory({ categoryId, sort }),
        ])
        if (cancelled) return
        setCategory(cat)
        setProducts(list)
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof Error ? e.message : '매물을 불러오지 못했습니다.',
        )
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authChecked, categoryId, sort])

  function handleSortChange(next: ProductSort) {
    if (next === sort) return
    if (categoryId === null) return
    router.replace(`/products?category=${categoryId}&sort=${next}`, {
      scroll: false,
    })
  }

  function handleCardClick(pid: string) {
    router.push(`/products/${pid}`)
  }

  if (!authChecked) {
    return (
      <div className="max-w-md mx-auto p-4">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    )
  }

  // 잘못된 categoryId — URL 손상 또는 직접 진입
  if (categoryId === null) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← 이전으로 돌아가기
        </button>
        <p className="text-sm text-gray-700">
          잘못된 접근입니다. 카테고리 정보가 없어요.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        ← 이전으로 돌아가기
      </button>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold">
          {category ? `${category.name} 매물` : '매물 목록'}
        </h1>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((opt) => {
          const active = opt.value === sort
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSortChange(opt.value)}
              className={`rounded-full px-3 py-1 text-sm border ${
                active
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">매물 불러오는 중...</p>
      ) : !error && category === null ? (
        <p className="text-sm text-gray-700">
          카테고리를 찾을 수 없어요.
        </p>
      ) : !error && products.length === 0 ? (
        <p className="text-sm text-gray-500">
          현재 등록된 {category?.name ?? '해당 카테고리'} 매물이 없어요.
        </p>
      ) : (
        <ul>
          {products.map((p) => (
            <li
              key={p.pid}
              className="border-t first:border-t-0"
            >
              <button
                type="button"
                onClick={() => handleCardClick(p.pid)}
                className="w-full text-left flex gap-3 py-3 hover:bg-gray-50"
              >
                <div className="relative w-20 h-20 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                  {p.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnail_url}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      이미지 없음
                    </div>
                  )}
                  {p.status === 'reserved' && (
                    <span className="absolute top-1 left-1 rounded bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5">
                      예약중
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.title}
                  </p>
                  <p className="text-base font-semibold text-gray-900">
                    {formatPrice(p.price)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.created_at.slice(0, 10)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
