'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

type ProductImage = { image_url: string; display_order: number }

type MyProduct = {
  pid: string
  title: string
  price: number
  status: string
  condition: string
  created_at: string
  product_images: ProductImage[] | null
}

const STATUS_LABEL: Record<string, string> = {
  selling: '판매중',
  reserved: '예약',
  sold: '판매완료',
}

export default function MyListingsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-products'],
    queryFn: async (): Promise<MyProduct[]> => {
      const res = await fetch('/api/my/products', { credentials: 'include' })
      if (res.status === 401) {
        throw new Error('로그인이 필요합니다.')
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? '목록을 불러오지 못했습니다.')
      }
      const json = (await res.json()) as { products?: MyProduct[] }
      return json.products ?? []
    },
  })

  if (isLoading) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>
  }

  if (error) {
    const msg = error instanceof Error ? error.message : '오류가 발생했습니다.'
    const needLogin = msg === '로그인이 필요합니다.'
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-700 mb-4" role="alert">
          {msg}
        </p>
        {needLogin ? (
          <Link
            href="/login"
            className="inline-block rounded-lg bg-[#8B0029] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B0020]"
          >
            로그인
          </Link>
        ) : null}
      </div>
    )
  }

  const products = data ?? []

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#8B0029] mb-1">판매 상품</h1>
        <p className="text-sm text-gray-600">내가 등록한 상품 목록이에요.</p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-gray-600 mb-4">등록한 상품이 없어요.</p>
          <Link
            href="/products/new"
            className="inline-block rounded-lg bg-[#8B0029] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B0020]"
          >
            판매하기
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const thumb = [...(p.product_images ?? [])].sort(
              (a, b) => a.display_order - b.display_order,
            )[0]
            return (
              <li key={p.pid}>
                <Link
                  href={`/products/${p.pid}`}
                  className="block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-[#8B0029]/40 hover:shadow-md"
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
                    <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 text-sm font-medium text-gray-900">{p.title}</p>
                    <p className="text-base font-semibold text-[#8B0029]">
                      {p.price.toLocaleString()}원
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
