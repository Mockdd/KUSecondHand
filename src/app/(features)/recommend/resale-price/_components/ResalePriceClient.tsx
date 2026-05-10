'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ResalePriceInput } from '@/types/recommend'
import { fetchCategoryAvgPrice, fetchMatchingPriceRule } from '@/lib/recommend/resalePriceQueries'
import { calculateResalePrice } from '@/lib/recommend/resalePriceCalculator'
import { ResalePriceForm } from './ResalePriceForm'
import { ResalePriceResultView } from './ResalePriceResult'

interface Props {
  categories: { category_id: number; name: string }[]
}

export function ResalePriceClient({ categories }: Props) {
  const [input, setInput] = useState<ResalePriceInput | null>(null)
  const supabase = createClient()

  const { data: result, isLoading, isError } = useQuery({
    queryKey: ['resale-price', input],
    enabled: input !== null,
    queryFn: async () => {
      if (!input) return null

      const [rule, priceData] = await Promise.all([
        fetchMatchingPriceRule(supabase, input),
        fetchCategoryAvgPrice(input.category_id),
      ])

      if (!rule) return null

      const referencePrice = input.purchase_price ?? priceData.avg_price
      if (referencePrice === null) return null

      const result = calculateResalePrice(referencePrice, rule, priceData.count)
      return {
        ...result,
        purchase_price: input.purchase_price,
        market_avg_price: priceData.avg_price ?? undefined,
      }
    },
  })

  return (
    <div className="space-y-6">
      <ResalePriceForm
        categories={categories}
        onSubmit={setInput}
        isLoading={isLoading}
      />

      {isLoading && (
        <div className="py-8 text-center text-sm text-gray-400">계산 중...</div>
      )}

      {isError && (
        <div className="py-8 text-center text-sm text-red-400">
          오류가 발생했어요. 다시 시도해주세요.
        </div>
      )}

      {!isLoading && input !== null && result === null && (
        <div className="rounded-lg bg-yellow-50 px-4 py-4 text-sm text-yellow-700">
          거래 데이터가 부족하거나 해당 조건에 맞는 감가율 규칙이 없어요.
          직접 가격을 책정해주세요.
        </div>
      )}

      {result && <ResalePriceResultView result={result} />}
    </div>
  )
}
