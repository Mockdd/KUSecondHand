import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type ProductRow = {
  pid: string
  title: string
  price: number
  product_images?: { image_url: string }[] | null
}

export async function RecentProducts() {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('products')
    .select('pid, title, price, product_images(image_url)')
    .is('deleted_at', null)
    .eq('status', 'selling')
    .order('created_at', { ascending: false })
    .limit(6)

  const products = (rows ?? []) as unknown as ProductRow[]

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">최근 등록 상품</h2>
        <Link
          href="/products"
          className="text-sm font-medium text-[#8B0029] hover:underline"
        >
          전체 보기
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-400">
            등록된 상품이 없거나 로그인이 필요합니다.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => {
            const img = p.product_images?.[0]?.image_url
            return (
              <li key={p.pid}>
                <Link
                  href={`/products/${p.pid}`}
                  className="group block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {img ? (
                      <Image
                        src={img}
                        alt=""
                        fill
                        className="object-cover transition-transform group-hover:scale-[1.03]"
                        sizes="(max-width:640px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
                          <rect x="3" y="3" width="18" height="18" rx="3" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm font-medium text-gray-900">{p.title}</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      {p.price.toLocaleString()}원
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
