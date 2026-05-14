import Link from 'next/link'
import { ResalePriceResult } from '@/types/recommend'

interface Props {
  result: ResalePriceResult
}

export function ResalePriceResultView({ result }: Props) {
  const depreciationPct = Math.round(result.depreciation_rate * 100)
  const usedPurchasePrice = result.purchase_price !== undefined
  const depreciationAmount = result.purchase_price
    ? result.purchase_price - result.recommended_price
    : null

  return (
    <div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50 p-5">
      <div className="text-center">
        <p className="text-sm font-medium text-blue-600">추천 재판매 가격</p>
        <p className="mt-1 text-3xl font-bold text-blue-700">
          {result.recommended_price.toLocaleString()}원
        </p>
        <p className="mt-1 text-xs text-blue-500">
          범위: {result.min_price.toLocaleString()}원 ~ {result.max_price.toLocaleString()}원
        </p>
      </div>

      <hr className="border-blue-200" />

      <div className="space-y-2 text-sm text-gray-600">
        {usedPurchasePrice ? (
          <>
            <div className="flex justify-between">
              <span>내 구매가</span>
              <span className="font-medium">{result.purchase_price!.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between">
              <span>적용 감가율</span>
              <span className="font-medium text-orange-600">{depreciationPct}%</span>
            </div>
            {depreciationAmount !== null && (
              <div className="flex justify-between">
                <span>예상 감가액</span>
                <span className="font-medium text-red-500">
                  -{depreciationAmount.toLocaleString()}원
                </span>
              </div>
            )}
            {result.market_avg_price !== undefined && (
              <div className="flex justify-between text-gray-400">
                <span>카테고리 평균 거래가 참고</span>
                <span>{result.market_avg_price.toLocaleString()}원</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-between">
            <span>기준 거래가 (카테고리 평균)</span>
            <span className="font-medium">{result.reference_price.toLocaleString()}원</span>
          </div>
        )}

        {!usedPurchasePrice && (
          <div className="flex justify-between">
            <span>적용 감가율</span>
            <span className="font-medium text-orange-600">{depreciationPct}%</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>참고 거래 건수</span>
          <span className="font-medium">{result.transaction_count}건</span>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        실제 거래 가격은 상품 상태에 따라 달라질 수 있어요.
      </p>

      <Link
        href={`/products/new?price=${result.recommended_price}`}
        className="block w-full rounded-lg py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#8B0029' }}
      >
        이 가격으로 판매하기 →
      </Link>
    </div>
  )
}
