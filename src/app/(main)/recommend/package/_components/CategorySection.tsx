import { useMemo } from 'react'
import { CategoryWithProducts } from '@/types/recommend'
import { ProductCard } from './ProductCard'

interface SelectedItem {
  price: number
  seller_uid: string
  category_id: number
}

interface Props {
  category: CategoryWithProducts
  selectedPids: Map<string, SelectedItem>
  onToggle: (pid: string, price: number, sellerUid: string, categoryId: number) => void
  skipped: boolean
  onSkip: () => void
  multiCategorySellers: Set<string>
  selectedSellerUids: Set<string>
}

export function CategorySection({
  category,
  selectedPids,
  onToggle,
  skipped,
  onSkip,
  multiCategorySellers,
  selectedSellerUids,
}: Props) {
  // 선택된 판매자 우선 → 멀티카테고리 판매자 → 나머지
  const sortedProducts = useMemo(() => {
    return [...category.products].sort((a, b) => {
      const aScore =
        (selectedSellerUids.has(a.seller_uid) ? 4 : 0) +
        (multiCategorySellers.has(a.seller_uid) ? 2 : 0)
      const bScore =
        (selectedSellerUids.has(b.seller_uid) ? 4 : 0) +
        (multiCategorySellers.has(b.seller_uid) ? 2 : 0)
      return bScore - aScore
    })
  }, [category.products, selectedSellerUids, multiCategorySellers])

  return (
    <div
      className={`rounded-xl border bg-white p-4 transition-opacity ${
        skipped ? 'border-gray-100 opacity-50' : 'border-gray-200'
      }`}
    >
      {/* 카테고리 헤더 */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-medium text-gray-800 truncate">
            {category.category_name}
            {category.required_quantity > 1 && (
              <span className="ml-1 text-sm text-gray-400">× {category.required_quantity}</span>
            )}
          </h3>
          {skipped && (
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              건너뜀
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-400">{category.products.length}개 매물</span>
          <button
            onClick={onSkip}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              skipped
                ? 'border-[#8B0029]/30 bg-[#FDF2F4] text-[#8B0029]'
                : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'
            }`}
          >
            {skipped ? (
              <>↩ 되돌리기</>
            ) : (
              <>
                <span className="text-base leading-none">✕</span> 선택 안함
              </>
            )}
          </button>
        </div>
      </div>

      {/* 상품 목록 */}
      {!skipped && (
        <>
          {category.products.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-400">
              아직 매물이 없어요
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sortedProducts.map((product) => (
                <ProductCard
                  key={product.pid}
                  product={product}
                  selected={selectedPids.has(product.pid)}
                  isMultiCategory={multiCategorySellers.has(product.seller_uid)}
                  isPreferredSeller={
                    !selectedPids.has(product.pid) &&
                    selectedSellerUids.has(product.seller_uid)
                  }
                  onToggle={() =>
                    onToggle(product.pid, product.price, product.seller_uid, category.category_id)
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
