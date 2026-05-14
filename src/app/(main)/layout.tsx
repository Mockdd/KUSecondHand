import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { NavBar } from '@/components/layout/NavBar'
import { CategoryBar } from '@/components/layout/CategoryBar'
import { createClient } from '@/lib/supabase/server'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('categories')
    .select('category_id, parent_id, name')
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('name')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        {/* 1행: 로고 + 메뉴 */}
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/emblem_ku.png"
              alt="고려대학교"
              width={28}
              height={28}
              className="opacity-90"
            />
            <span className="font-bold text-[#8B0029] text-base tracking-tight">
              KU Secondhand
            </span>
          </Link>
          <NavBar />
        </div>

        {/* 2행: 카테고리 */}
        <div className="border-t border-gray-100 py-0.5">
          <Suspense fallback={<div className="h-9" />}>
            <CategoryBar categories={categories ?? []} />
          </Suspense>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
