import Link from 'next/link'

function ShoppingBagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  )
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  )
}

function TrendingUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
      <polyline strokeLinecap="round" strokeLinejoin="round" points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline strokeLinecap="round" strokeLinejoin="round" points="17 6 23 6 23 12" />
    </svg>
  )
}

function PlusCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
      <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="8" x2="12" y2="16" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ACTIONS = [
  {
    href: '/products',
    label: '상품 목록',
    desc: '전체 중고 상품 탐색',
    Icon: ShoppingBagIcon,
    bgColor: '#FDF2F4',
    iconColor: '#8B0029',
  },
  {
    href: '/recommend/package',
    label: '패키지 추천',
    desc: '필요한 물품 묶음 추천',
    Icon: GiftIcon,
    bgColor: '#EEF2FF',
    iconColor: '#4F46E5',
  },
  {
    href: '/recommend/resale-price',
    label: '시세 추천',
    desc: '내 물건 적정가 계산',
    Icon: TrendingUpIcon,
    bgColor: '#F0FDF4',
    iconColor: '#16A34A',
  },
  {
    href: '/products/new',
    label: '상품 등록',
    desc: '판매할 물건 올리기',
    Icon: PlusCircleIcon,
    bgColor: '#FFFBEB',
    iconColor: '#D97706',
  },
]

export function QuickActionGrid() {
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-gray-900">바로가기</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map(({ href, label, desc, Icon, bgColor, iconColor }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: bgColor, color: iconColor }}
            >
              <Icon />
            </span>
            <span>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[#8B0029] transition-colors">
                {label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
