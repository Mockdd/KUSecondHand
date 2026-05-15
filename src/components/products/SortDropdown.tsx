'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export type SortKey = 'recent' | 'price_asc' | 'price_desc' | 'wishlist'

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: '최신순' },
  { value: 'price_asc', label: '가격 낮은순' },
  { value: 'price_desc', label: '가격 높은순' },
  { value: 'wishlist', label: '찜 많은순' },
]

interface Props {
  current: SortKey
}

export function SortDropdown({ current }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as SortKey
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'recent') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `/products?${qs}` : '/products')
    })
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">정렬</span>
      <select
        value={current}
        onChange={handleChange}
        disabled={isPending}
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm transition-colors hover:border-[#8B0029] focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029] disabled:opacity-60"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
