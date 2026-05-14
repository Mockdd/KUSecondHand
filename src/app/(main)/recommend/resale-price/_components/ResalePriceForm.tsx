'use client'

import { useState } from 'react'
import { CONDITION_LABELS, ProductCondition, ResalePriceInput } from '@/types/recommend'

interface Props {
  categories: { category_id: number; name: string }[]
  onSubmit: (input: ResalePriceInput) => void
  isLoading: boolean
}

const CONDITIONS: ProductCondition[] = ['high', 'medium', 'low']

export function ResalePriceForm({ categories, onSubmit, isLoading }: Props) {
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [condition, setCondition] = useState<ProductCondition | ''>('')
  const [usageMonths, setUsageMonths] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryId || !condition || usageMonths === '') return

    const months = parseInt(usageMonths, 10)
    if (isNaN(months) || months < 0) return

    const price = purchasePrice !== '' ? parseInt(purchasePrice, 10) : undefined
    if (price !== undefined && (isNaN(price) || price <= 0)) return

    onSubmit({
      category_id: Number(categoryId),
      condition,
      usage_months: months,
      purchase_price: price,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">카테고리</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          required
        >
          <option value="">선택하세요</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">상품 상태</label>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as ProductCondition)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          required
        >
          <option value="">선택하세요</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {CONDITION_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          사용 기간 (개월)
        </label>
        <input
          type="number"
          min="0"
          max="120"
          value={usageMonths}
          onChange={(e) => setUsageMonths(e.target.value)}
          placeholder="예: 6"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          구매 가격 (원)
          <span className="ml-1 font-normal text-gray-400">— 선택사항</span>
        </label>
        <input
          type="number"
          min="1"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="예: 1200000"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">
          입력하면 내 구매가 기준으로 계산합니다. 비워두면 카테고리 평균 거래가를 사용해요.
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? '계산 중...' : '추천 가격 계산'}
      </button>
    </form>
  )
}
