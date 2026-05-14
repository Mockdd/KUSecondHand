'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense } from 'react'

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

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
        className="w-52 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
      />
    </form>
  )
}

export function NavBar() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <div className="flex items-center gap-5">
      <Suspense fallback={<div className="w-52 h-8 bg-gray-100 rounded-lg" />}>
        <SearchInput />
      </Suspense>

      <nav className="flex items-center gap-5 text-sm">
        <Link
          href="/recommend/package"
          className={`whitespace-nowrap hover:text-[#8B0029] transition-colors ${isActive('/recommend/package') ? 'text-[#8B0029] font-semibold' : 'text-gray-600'}`}
        >
          패키지
        </Link>
        <Link
          href="/products"
          className={`whitespace-nowrap hover:text-[#8B0029] transition-colors ${isActive('/products') ? 'text-[#8B0029] font-semibold' : 'text-gray-600'}`}
        >
          상품
        </Link>
        <Link
          href="/products/new"
          className="whitespace-nowrap rounded-lg bg-[#8B0029] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6B0020] transition-colors"
        >
          판매
        </Link>
        <Link
          href="/chat"
          aria-label="채팅"
          className={`hover:text-[#8B0029] transition-colors ${isActive('/chat') ? 'text-[#8B0029]' : 'text-gray-600'}`}
        >
          <ChatIcon />
        </Link>
        <Link
          href="/my/profile"
          className={`whitespace-nowrap hover:text-[#8B0029] transition-colors ${isActive('/my') ? 'text-[#8B0029] font-semibold' : 'text-gray-600'}`}
        >
          MY
        </Link>
      </nav>
    </div>
  )
}
