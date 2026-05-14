import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { productListSelect } from '@/lib/products/sellerEmbed'

type ProductRow = {
  pid: string
  title: string
  price: number
  product_images?: { image_url: string }[] | null
  wishlists?: { count: number }[]
}

export async function PopularProducts() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('products')
    .select(`${productListSelect()}, wishlists(count)`)
    .eq('status', 'selling')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(18)

  const products = ((rows ?? []) as unknown as ProductRow[])
    .map((p) => ({
      ...p,
      wishlistCount: (p.wishlists?.[0] as unknown as { count: number })?.count ?? 0,
    }))
    .sort((a, b) => b.wishlistCount - a.wishlistCount)
    .slice(0, 6)

  if (products.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">인기 상품</h2>
          <p className="text-xs text-gray-400 mt-0.5">학우들이 가장 많이 찜한 상품</p>
        </div>
        <Link href="/products" className="text-sm text-[#8B0029] font-medium hover:underline">
          전체보기 →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {products.map((p) => {
          const img = p.product_images?.[0]?.image_url
          return (
            <Link
              key={p.pid}
              href={`/products/${p.pid}`}
              className="group rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative aspect-square bg-gray-100">
                {img ? (
                  <Image
                    src={img}
                    alt=""
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 17vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-2xl text-gray-200">
                    📦
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-800 line-clamp-1">{p.title}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{p.price.toLocaleString()}원</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
