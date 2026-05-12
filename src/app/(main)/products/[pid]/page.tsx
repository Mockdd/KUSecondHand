import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TrustBadge } from '@/components/trust/TrustBadge'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { ChatButton } from '@/components/chat/ChatButton'
import { createClient } from '@/lib/supabase/server'
import { isTrustedSeller } from '@/lib/trust/constants'
import { productDetailSelect } from '@/lib/products/sellerEmbed'

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
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm text-gray-400">
        <Link href="/products" className="text-gray-600 hover:underline">
          목록
        </Link>{' '}
        · pid: {pid}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative aspect-square bg-gray-100">
          {images[0]?.image_url ? (
            <Image
              src={images[0].image_url}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width:640px) 100vw, 50vw"
              priority
            />
          ) : null}
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-gray-900">{row.title}</h1>
          <p className="text-xl font-semibold">{row.price.toLocaleString()}원</p>
          <p className="text-sm text-gray-600">상태: {row.condition}</p>

          <WishlistButton pid={pid} />
          {seller && <ChatButton pid={pid} sellerUid={seller.uid} />}

          {seller ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">판매자</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-gray-800">{seller.nickname}</span>
                <TrustBadge trusted={isTrustedSeller(seller.successful_trade_count)} />
                <span className="text-gray-500">
                  매너 온도{' '}
                  {seller.manner_temperature != null ? String(seller.manner_temperature) : '—'}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {row.description ? (
        <section className="space-y-2 text-gray-800">
          <h2 className="text-lg font-semibold text-gray-900">설명</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{row.description}</p>
        </section>
      ) : null}

      {images.length > 1 ? (
        <section className="flex gap-2 overflow-x-auto pb-2">
          {images.slice(1).map((im, i) => (
            <div key={i} className="relative h-24 w-24 shrink-0 bg-gray-100">
              <Image
                src={im.image_url}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  )
}
