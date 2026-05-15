import Image from 'next/image'
import Link from 'next/link'

import { TrustBadge } from '@/components/trust/TrustBadge'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { SortDropdown, type SortKey } from '@/components/products/SortDropdown'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { isTrustedSeller } from '@/lib/trust/constants'
import { productListSelect } from '@/lib/products/sellerEmbed'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 40

type Seller = {
  uid: string
  nickname: string
  profile_image_url: string | null
  manner_temperature: number | string | null
  successful_trade_count?: number | null
}

type ProductRow = {
  pid: string
  title: string
  price: number
  seller: Seller | null
  product_images?: { image_url: string }[] | null
}

function parseSort(raw: string | undefined): SortKey {
  switch (raw) {
    case 'price_asc':
    case 'price_desc':
    case 'wishlist':
      return raw
    default:
      return 'recent'
  }
}

async function getWishlistCounts(): Promise<Map<string, number>> {
  // wishlists 는 RLS 로 본인 데이터만 보이므로 집계에는 service role 사용
  const admin = createServiceRoleClient()
  if (!admin) return new Map()

  const { data, error } = await admin.from('wishlists').select('pid')
  if (error || !data) return new Map()

  const counts = new Map<string, number>()
  for (const row of data as { pid: string }[]) {
    counts.set(row.pid, (counts.get(row.pid) ?? 0) + 1)
  }
  return counts
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category_id?: string; sort?: string }>
}) {
  const { category_id, sort } = await searchParams
  const categoryId = category_id ? Number(category_id) : null
  const sortKey = parseSort(sort)

  const supabase = await createClient()

  let categoryIds: number[] | null = null
  if (categoryId) {
    const { data: categoryTree } = await supabase
      .from('categories')
      .select('category_id, parent_id')

    const allIds = new Set<number>([categoryId])
    categoryTree?.forEach((c) => {
      if (c.parent_id === categoryId) allIds.add(c.category_id)
    })
    categoryIds = [...allIds]
  }

  // 정렬별로 다른 쿼리 경로:
  //   - wishlist: 카운트로 정렬해야 하므로 매물을 모두 가져온 뒤 JS 정렬
  //   - 나머지: DB 정렬 + LIMIT
  let baseQuery = supabase
    .from('products')
    .select(productListSelect())
    .is('deleted_at', null)
    .eq('status', 'selling')

  if (categoryIds) {
    baseQuery = baseQuery.in('category_id', categoryIds)
  }

  let rows: ProductRow[] = []
  let error: { message: string } | null = null
  const wishlistCounts = await getWishlistCounts()

  if (sortKey === 'wishlist') {
    const { data, error: qErr } = await baseQuery.order('created_at', { ascending: false })
    if (qErr) {
      error = qErr
    } else {
      const all = (data ?? []) as unknown as ProductRow[]
      all.sort((a, b) => (wishlistCounts.get(b.pid) ?? 0) - (wishlistCounts.get(a.pid) ?? 0))
      rows = all.slice(0, PAGE_SIZE)
    }
  } else {
    let q = baseQuery
    if (sortKey === 'price_asc') {
      q = q.order('price', { ascending: true }).order('created_at', { ascending: false })
    } else if (sortKey === 'price_desc') {
      q = q.order('price', { ascending: false }).order('created_at', { ascending: false })
    } else {
      q = q.order('created_at', { ascending: false })
    }
    const { data, error: qErr } = await q.range(0, PAGE_SIZE - 1)
    if (qErr) {
      error = qErr
    } else {
      rows = (data ?? []) as unknown as ProductRow[]
    }
  }

  let categoryName: string | null = null
  if (categoryId) {
    const { data: cat } = await supabase
      .from('categories')
      .select('name')
      .eq('category_id', categoryId)
      .maybeSingle()
    categoryName = cat?.name ?? null
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">상품 목록</h1>
        <p className="text-red-600 text-sm">{error.message}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {categoryName ? `${categoryName} 상품` : '상품 목록'}
        </h1>
        <SortDropdown current={sortKey} />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          {categoryName ? `${categoryName} 카테고리에 등록된 상품이 없어요.` : '등록된 상품이 없어요.'}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const img = p.product_images?.[0]?.image_url
            const seller = p.seller
            const wishCount = wishlistCounts.get(p.pid) ?? 0
            return (
              <li
                key={p.pid}
                className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <Link href={`/products/${p.pid}`} className="block">
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {img ? (
                      <Image
                        src={img}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width:768px) 100vw, 33vw"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 font-medium text-gray-900">{p.title}</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {p.price.toLocaleString()}원
                    </p>
                    {seller ? (
                      <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                        <span>{seller.nickname}</span>
                        <TrustBadge trusted={isTrustedSeller(seller.successful_trade_count)} />
                        <span className="text-gray-400">
                          온도{' '}
                          {seller.manner_temperature != null ? String(seller.manner_temperature) : '—'}
                        </span>
                      </p>
                    ) : null}
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <span aria-hidden className="text-red-400">♡</span>
                      <span>{wishCount.toLocaleString()}</span>
                    </p>
                  </div>
                </Link>
                <div className="absolute right-2 top-2">
                  <WishlistButton pid={p.pid} compact />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
