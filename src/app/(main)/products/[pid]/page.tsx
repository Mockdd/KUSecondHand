import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TrustBadge } from '@/components/trust/TrustBadge'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { ChatButton } from '@/components/chat/ChatButton'
import { createClient } from '@/lib/supabase/server'
import { isTrustedSeller } from '@/lib/trust/constants'
import { productDetailSelect } from '@/lib/products/sellerEmbed'
import { formatCondition } from '@/lib/utils/format'

export const dynamic = 'force-dynamic'

type Seller = {
  uid: string
  nickname: string
  profile_image_url: string | null
  manner_temperature: number | string | null
  successful_trade_count?: number | null
}

export default async function ProductDetailPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select(productDetailSelect())
    .eq('pid', pid)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) {
    notFound()
  }

  const row = data as unknown as {
    title: string
    price: number
    description: string | null
    condition: string
    seller: Seller | null
    product_images?: { image_url: string; display_order?: number }[] | null
  }

  const images = [...(row.product_images ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  )
  const seller = row.seller

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <p className="text-sm text-gray-400">
        <Link href="/products" className="hover:text-[#8B0029] transition-colors">
          ← 목록으로
        </Link>
      </p>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="relative aspect-square bg-gray-100 rounded-2xl overflow-hidden shadow-md">
          {images[0]?.image_url ? (
            <Image
              src={images[0].image_url}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width:640px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl text-gray-200">
              📦
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{row.title}</h1>
            <p className="mt-2 text-2xl font-bold text-[#8B0029]">{row.price.toLocaleString()}원</p>
          </div>

          <div>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              상태: {formatCondition(row.condition)}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <WishlistButton pid={pid} />
            {seller && <ChatButton pid={pid} sellerUid={seller.uid} productTitle={row.title} />}
          </div>

          {seller ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">판매자</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{seller.nickname}</span>
                <TrustBadge trusted={isTrustedSeller(seller.successful_trade_count)} />
                <span className="text-xs text-gray-500">
                  매너 온도{' '}
                  {seller.manner_temperature != null ? String(seller.manner_temperature) : '—'}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {row.description ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-3">상품 설명</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{row.description}</p>
        </section>
      ) : null}

      {images.length > 1 ? (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">추가 사진</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.slice(1).map((im, i) => (
              <div key={i} className="relative h-24 w-24 shrink-0 rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                <Image
                  src={im.image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
