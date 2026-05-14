import Link from 'next/link'
import { CONDITION_LABELS, ProductSummary } from '@/types/recommend'

interface Props {
  product: ProductSummary
  selected?: boolean
  isMultiCategory?: boolean
  isPreferredSeller?: boolean
  onToggle?: () => void
}

export function ProductCard({
  product,
  selected = false,
  isMultiCategory = false,
  isPreferredSeller = false,
  onToggle,
}: Props) {
  const borderClass = selected
    ? 'border-[#8B0029] ring-2 ring-[#8B0029]/30 shadow-md'
    : isPreferredSeller
    ? 'border-blue-400 ring-1 ring-blue-200'
    : isMultiCategory
    ? 'border-amber-300 hover:border-amber-400 hover:shadow-sm'
    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'

  return (
    <div
      onClick={onToggle}
      className={`relative flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-all ${borderClass}`}
    >
      {/* 멀티카테고리 뱃지 */}
      {isMultiCategory && !selected && (
        <div className="absolute left-0 top-0 z-10 rounded-br-lg bg-amber-400 px-1.5 py-0.5">
          <span className="text-[10px] font-bold text-white leading-none">⭐</span>
        </div>
      )}

      {/* 같은 판매자 선택중 표시 */}
      {isPreferredSeller && (
        <div className="absolute left-0 top-0 z-10 rounded-br-lg bg-blue-500 px-1.5 py-0.5">
          <span className="text-[9px] font-bold text-white leading-none">동일</span>
        </div>
      )}

      {/* 선택 체크 */}
      <div
        className={`absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
          selected
            ? 'border-[#8B0029] bg-[#8B0029] text-white'
            : 'border-gray-300 bg-white/80'
        }`}
      >
        {selected && (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* 상세 보기 링크 */}
      <Link
        href={`/products/${product.pid}`}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        title="상세 보기"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </Link>

      {/* 이미지 */}
      <div className="h-28 w-full bg-gray-100">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-300">
            이미지 없음
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="p-2">
        <p className="truncate text-xs font-medium text-gray-800">{product.title}</p>
        <p className={`mt-0.5 text-xs font-semibold ${selected ? 'text-[#8B0029]' : 'text-gray-700'}`}>
          {product.price.toLocaleString()}원
        </p>
        <p className="mt-0.5 text-xs text-gray-400">{CONDITION_LABELS[product.condition]}</p>
        <p className="mt-0.5 truncate text-[10px] text-gray-400">{product.seller_name}</p>
      </div>
    </div>
  )
}
