'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

type Category = { category_id: number; parent_id: number | null; name: string }

interface Props {
  categories: Category[]
}

export function CategoryBar({ categories }: Props) {
  const searchParams = useSearchParams()
  const activeCategoryId = searchParams.get('category_id')
    ? Number(searchParams.get('category_id'))
    : null

  const parents = categories.filter((c) => c.parent_id === null)
  const [openId, setOpenId] = useState<number | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleMouseEnter(id: number) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setOpenId(id)
  }

  function handleMouseLeave() {
    closeTimerRef.current = setTimeout(() => setOpenId(null), 120)
  }

  return (
    <nav className="max-w-5xl mx-auto px-4">
      <ul className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <li>
          <Link
            href="/products"
            className={`block px-3 py-2 text-sm whitespace-nowrap rounded transition-colors ${
              activeCategoryId === null
                ? 'text-[#8B0029] font-semibold'
                : 'text-gray-600 hover:text-[#8B0029]'
            }`}
          >
            전체
          </Link>
        </li>

        {parents.map((parent) => {
          const children = categories.filter((c) => c.parent_id === parent.category_id)
          const isParentActive =
            activeCategoryId === parent.category_id ||
            children.some((c) => c.category_id === activeCategoryId)

          return (
            <li
              key={parent.category_id}
              className="relative"
              onMouseEnter={() => handleMouseEnter(parent.category_id)}
              onMouseLeave={handleMouseLeave}
            >
              <Link
                href={`/products?category_id=${parent.category_id}`}
                className={`flex items-center gap-0.5 px-3 py-2 text-sm whitespace-nowrap rounded transition-colors ${
                  isParentActive
                    ? 'text-[#8B0029] font-semibold'
                    : 'text-gray-600 hover:text-[#8B0029]'
                }`}
              >
                {parent.name}
                {children.length > 0 && (
                  <svg
                    viewBox="0 0 10 6"
                    fill="currentColor"
                    className="h-2.5 w-2.5 opacity-50"
                  >
                    <path d="M0 0l5 6 5-6z" />
                  </svg>
                )}
              </Link>

              {openId === parent.category_id && children.length > 0 && (
                <div
                  className="absolute left-0 top-full z-50 min-w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                  onMouseEnter={() => handleMouseEnter(parent.category_id)}
                  onMouseLeave={handleMouseLeave}
                >
                  {children.map((child) => (
                    <Link
                      key={child.category_id}
                      href={`/products?category_id=${child.category_id}`}
                      className={`block px-4 py-2 text-sm whitespace-nowrap transition-colors ${
                        activeCategoryId === child.category_id
                          ? 'bg-[#FDF2F4] text-[#8B0029] font-medium'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-[#8B0029]'
                      }`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
