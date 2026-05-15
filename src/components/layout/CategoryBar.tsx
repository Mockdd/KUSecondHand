'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
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
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRefs = useRef<Map<number, HTMLLIElement>>(new Map())

  function openDropdown(id: number) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    const el = triggerRefs.current.get(id)
    if (el) {
      const r = el.getBoundingClientRect()
      setPos({ left: r.left, top: r.bottom })
    }
    setOpenId(id)
  }

  function scheduleClose() {
    closeTimerRef.current = setTimeout(() => {
      setOpenId(null)
      setPos(null)
    }, 120)
  }

  function cancelClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
  }

  // 스크롤·리사이즈 시 fixed 좌표가 어긋나므로 즉시 닫음
  useEffect(() => {
    if (openId === null) return
    const close = () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      setOpenId(null)
      setPos(null)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [openId])

  const openParent =
    openId !== null ? parents.find((p) => p.category_id === openId) : null
  const openChildren = openParent
    ? categories.filter((c) => c.parent_id === openParent.category_id)
    : []

  return (
    <nav className="max-w-5xl mx-auto px-4">
      <ul
        className="flex items-center gap-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
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
          const children = categories.filter(
            (c) => c.parent_id === parent.category_id,
          )
          const isParentActive =
            activeCategoryId === parent.category_id ||
            children.some((c) => c.category_id === activeCategoryId)
          const hasChildren = children.length > 0

          return (
            <li
              key={parent.category_id}
              ref={(el) => {
                if (el) triggerRefs.current.set(parent.category_id, el)
                else triggerRefs.current.delete(parent.category_id)
              }}
              onMouseEnter={() => {
                if (hasChildren) openDropdown(parent.category_id)
              }}
              onMouseLeave={() => {
                if (hasChildren) scheduleClose()
              }}
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
                {hasChildren && (
                  <svg
                    viewBox="0 0 10 6"
                    fill="currentColor"
                    className="h-2.5 w-2.5 opacity-50"
                  >
                    <path d="M0 0l5 6 5-6z" />
                  </svg>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {openParent && openChildren.length > 0 && pos && (
        <div
          className="fixed z-50 min-w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={{ left: pos.left, top: pos.top }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {openChildren.map((child) => (
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
    </nav>
  )
}
