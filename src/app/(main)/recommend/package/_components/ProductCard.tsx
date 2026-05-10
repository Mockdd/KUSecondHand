import Link from 'next/link'
import { CONDITION_LABELS, ProductSummary } from '@/types/recommend'

interface Props {
  product: ProductSummary
  selected?: boolean
  onToggle?: () => void
}

export function ProductCard({ product, selected = false, onToggle }: Props) {
  return (
    <div
      onClick={onToggle}
      className={`relative flex w-36 shrink-0 cursor-pointer flex-col overflow-hidden rounded-lg border transition-all ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-400 shadow-md'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      {/* 선택 체크 */}
      <div
        className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
          selected
            ? 'border-blue-500 bg-blue-500 text-white'
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
        className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        title="상세 보기"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </Link>

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
      <div className="p-2">
        <p className="truncate text-xs font-medium text-gray-800">{product.title}</p>
        <p className="mt-0.5 text-xs font-semibold text-blue-600">
          {product.price.toLocaleString()}원
        </p>
        <p className="mt-0.5 text-xs text-gray-400">{CONDITION_LABELS[product.condition]}</p>
      </div>
    </div>
  )
}
