'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'

// ──────────────────────────────────────────────────────────────────────────────
// 하단 네비게이션
// ──────────────────────────────────────────────────────────────────────────────

function BottomNav() {
  const pathname = usePathname()
  const { profile } = useExchangeProfile()

  const isSeller = profile?.role === 'outgoing'

  const tabs = isSeller
    ? [
        { label: '등록', href: '/sell/template', match: '/sell' },
        { label: '현황', href: '/packages',      match: '/packages' },
        { label: '채팅', href: '/chat',           match: '/chat' },
        { label: '알림', href: '/wishlist',       match: '/wishlist' },
        { label: '마이', href: '/mypage',         match: '/mypage' },
      ]
    : [
        { label: '추천', href: '/packages',  match: '/packages' },
        { label: '채팅', href: '/chat',      match: '/chat' },
        { label: '알림', href: '/wishlist',  match: '/wishlist' },
        { label: '마이', href: '/mypage',    match: '/mypage' },
      ]

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-200 flex">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.match)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
              isActive ? 'text-black' : 'text-gray-400'
            }`}
          >
            <span className={`block text-base mb-0.5 ${isActive ? 'scale-110' : ''}`}>
              {TAB_ICON[tab.label]}
            </span>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

const TAB_ICON: Record<string, string> = {
  홈:   '⌂',
  등록: '＋',
  현황: '☰',
  추천: '✦',
  채팅: '💬',
  알림: '🔔',
  마이: '👤',
}

// ──────────────────────────────────────────────────────────────────────────────
// 레이아웃
// ──────────────────────────────────────────────────────────────────────────────

export default function ExchangeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <main className="pb-20">{children}</main>
      <BottomNav />
    </>
  )
}
