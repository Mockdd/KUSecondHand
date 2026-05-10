import Image from 'next/image'
import Link from 'next/link'

import { TrustBadge } from '@/components/trust/TrustBadge'
import { createClient } from '@/lib/supabase/server'
import { isTrustedSeller } from '@/lib/trust/constants'
import { productListSelect } from '@/lib/products/sellerEmbed'

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

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('products')
    .select(productListSelect())
    .is('deleted_at', null)
    .eq('status', 'selling')
    .order('created_at', { ascending: false })
    .range(0, 19)

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">상품 목록</h1>
        <p className="text-red-600 text-sm">{error.message}</p>
      </div>
    )
  }

  const products = (rows ?? []) as ProductRow[]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">상품 목록</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const img = p.product_images?.[0]?.image_url
          const seller = p.seller
          return (
            <li
              key={p.pid}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
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
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
