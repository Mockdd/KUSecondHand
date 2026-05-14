'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense } from 'react'

const NAV_ITEMS = [
  { label: '상품',     href: '/products' },
  { label: '패키지',   href: '/packages' },
  { label: '패키지 추천', href: '/recommend/package' },
  { label: '시세 추천',   href: '/recommend/resale-price' },
  { label: '시간표 추천', href: '/recommendations' },
  { label: '채팅',     href: '/chat' },
  { label: '위시리스트', href: '/wishlist' },
  { label: '판매', href: '/products/new' },
  { label: '마이페이지', href: '/my/profile' },
]

function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="상품 검색..."
        className="w-52 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </form>
  )
}

export function NavBar() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-4">
      <Suspense fallback={<div className="w-52 h-8 bg-gray-100 rounded-lg" />}>
        <SearchInput />
      </Suspense>
      <nav className="flex items-center gap-4 text-sm">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hover:text-indigo-600 whitespace-nowrap ${
              pathname.startsWith(item.href)
                ? 'text-indigo-600 font-medium'
                : 'text-gray-600'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
