import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResalePriceClient } from './_components/ResalePriceClient'

export const dynamic = 'force-dynamic'

export default async function ResalePricePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/recommend/resale-price')

  const { data: categories } = await supabase
    .from('categories')
    .select('category_id, name')
    .order('name')

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">재판매 가격 추천</h1>
        <p className="mb-6 text-sm text-gray-500">
          상품 상태와 사용 기간을 입력하면 적정 재판매 가격을 알려드려요.
        </p>
        <ResalePriceClient categories={categories ?? []} />
      </div>
    </main>
  )
}
