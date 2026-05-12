'use client'

import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense, useState, useEffect, useRef } from 'react'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'
import type { ProductSearchResult, PackageSearchResult } from '@/lib/search/hybridSearch'

// ──────────────────────────────────────────────────────────────────────────────
// 상품 상태 레이블
// ──────────────────────────────────────────────────────────────────────────────

const CONDITION_LABEL: Record<string, string> = {
  new: '새것',
  like_new: '거의 새것',
  good: '양호',
  fair: '보통',
  poor: '낡음',
}

// ──────────────────────────────────────────────────────────────────────────────
// 검색 로직 (debounce + URL 동기화)
// ──────────────────────────────────────────────────────────────────────────────

function useSearch(initialQ: string) {
  const router = useRouter()
  const [inputQ, setInputQ] = useState(initialQ)
  const [debouncedQ, setDebouncedQ] = useState(initialQ)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedQ(inputQ.trim())
      if (inputQ.trim()) {
        router.replace(`/search?q=${encodeURIComponent(inputQ.trim())}`, { scroll: false })
      }
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [inputQ, router])

  return { inputQ, setInputQ, debouncedQ }
}

// ──────────────────────────────────────────────────────────────────────────────
// 매물 카드
// ──────────────────────────────────────────────────────────────────────────────

function ProductCard({ item }: { item: ProductSearchResult }) {
  return (
    <Link
      href={`/products/${item.pid}`}
      className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-indigo-300 transition-colors"
    >
      <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
        {item.thumbnail ? (
          <Image src={item.thumbnail} alt={item.title} width={64} height={64} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">없음</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.title}</p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">{item.price.toLocaleString()}원</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {CONDITION_LABEL[item.condition] ?? item.condition} · {item.seller_nickname}
        </p>
      </div>
    </Link>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 패키지 카드
// ──────────────────────────────────────────────────────────────────────────────

function PackageCard({ item }: { item: PackageSearchResult }) {
  return (
    <Link
      href="/packages"
      className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 hover:border-indigo-300 transition-colors"
    >
      <p className="font-medium text-gray-900">{item.name_ko}</p>
      <p className="text-xs text-gray-400">{item.name_en}</p>
      {item.housing_type && (
        <span className="text-xs text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5 w-fit">
          {item.housing_type === 'dorm' ? '기숙사' : '자취'}
        </span>
      )}
    </Link>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 메인 검색 컨텐츠
// ──────────────────────────────────────────────────────────────────────────────

function SearchContent() {
  const searchParams = useSearchParams()
  const { profile } = useExchangeProfile()
  const isExchange = !!profile

  const { inputQ, setInputQ, debouncedQ } = useSearch(searchParams.get('q') ?? '')
  const [activeTab, setActiveTab] = useState<'products' | 'packages'>('products')

  const { data: productData, isFetching: productsFetching } = useQuery({
    queryKey: ['search', 'products', debouncedQ],
    queryFn: async (): Promise<ProductSearchResult[]> => {
      if (!debouncedQ) return []
      const res = await fetch(`/api/search/products?q=${encodeURIComponent(debouncedQ)}`)
      if (!res.ok) throw new Error('검색 실패')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!debouncedQ,
    staleTime: 30 * 1000,
  })

  const { data: packageData, isFetching: packagesFetching } = useQuery({
    queryKey: ['search', 'packages', debouncedQ],
    queryFn: async (): Promise<PackageSearchResult[]> => {
      if (!debouncedQ || !isExchange) return []
      const res = await fetch(`/api/search/packages?q=${encodeURIComponent(debouncedQ)}`)
      if (!res.ok) throw new Error('검색 실패')
      const json = await res.json()
      return json.data ?? []
    },
    enabled: !!debouncedQ && isExchange,
    staleTime: 30 * 1000,
  })

  const products = productData ?? []
  const packages = packageData ?? []
  const isFetching = productsFetching || packagesFetching

  return (
    <div className="space-y-5">
      {/* 검색창 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">검색</h1>
        <input
          type="search"
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          placeholder="검색어를 입력하세요"
          autoFocus
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* 쿼리 없음 */}
      {!debouncedQ && (
        <p className="text-sm text-gray-400 text-center py-12">검색어를 입력하면 결과가 표시돼요</p>
      )}

      {/* 로딩 */}
      {debouncedQ && isFetching && (
        <p className="text-sm text-gray-400">검색 중...</p>
      )}

      {/* 결과 */}
      {debouncedQ && !isFetching && (
        <>
          {/* 탭 — 교환학생만 */}
          {isExchange && (
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
              {(['products', 'packages'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'products' ? `매물 (${products.length})` : `패키지 (${packages.length})`}
                </button>
              ))}
            </div>
          )}

          {/* 매물 결과 */}
          {(!isExchange || activeTab === 'products') && (
            <div className="space-y-3">
              {!isExchange && (
                <p className="text-sm text-gray-500">매물 {products.length}개</p>
              )}
              {products.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                  <p className="text-sm text-gray-500">&apos;{debouncedQ}&apos; 검색 결과가 없어요</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {products.map((item) => <ProductCard key={item.pid} item={item} />)}
                </div>
              )}
            </div>
          )}

          {/* 패키지 결과 — 교환학생만 */}
          {isExchange && activeTab === 'packages' && (
            <div className="space-y-3">
              {packages.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                  <p className="text-sm text-gray-500">&apos;{debouncedQ}&apos; 패키지 검색 결과가 없어요</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {packages.map((item) => <PackageCard key={item.package_id} item={item} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 페이지 (Suspense wrapper — useSearchParams 요건)
// ──────────────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">로딩 중...</p>}>
      <SearchContent />
    </Suspense>
  )
}
