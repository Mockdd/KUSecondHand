import { Suspense } from 'react'
import { CategoryBar } from '@/components/layout/CategoryBar'
import { createClient } from '@/lib/supabase/server'

export default async function ProductsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('category_id, parent_id, name')
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('name')

  return (
    <>
      <div className="sticky top-[52px] z-30 -mx-4 -mt-6 mb-6 border-b border-gray-100 bg-white py-0.5">
        <Suspense fallback={<div className="h-9" />}>
          <CategoryBar categories={categories ?? []} />
        </Suspense>
      </div>
      {children}
    </>
  )
}
