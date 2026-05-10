import { ResalePriceResult, ResalePriceRule } from '@/types/recommend'

export function calculateResalePrice(
  referencePrice: number,
  rule: ResalePriceRule,
  transactionCount: number
): ResalePriceResult {
  const { depreciation_rate, min_price_ratio, max_price_ratio } = rule

  const rawPrice = Math.round(referencePrice * (1 - depreciation_rate))
  const minPrice = Math.round(referencePrice * min_price_ratio)
  const maxPrice = Math.round(referencePrice * max_price_ratio)
  const recommendedPrice = Math.max(minPrice, Math.min(rawPrice, maxPrice))

  return {
    reference_price: referencePrice,
    transaction_count: transactionCount,
    recommended_price: recommendedPrice,
    min_price: minPrice,
    max_price: maxPrice,
    depreciation_rate,
  }
}
