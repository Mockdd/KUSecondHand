import { CategoryWithProducts } from '@/types/recommend'
import { ProductCard } from './ProductCard'

interface Props {
  category: CategoryWithProducts
  selectedPids: Map<string, number>
  onToggle: (pid: string, price: number) => void
}

export function CategorySection({ category, selectedPids, onToggle }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-gray-800">
          {category.category_name}
          {category.required_quantity > 1 && (
            <span className="ml-1 text-sm text-gray-400">× {category.required_quantity}</span>
          )}
        </h3>
        <span className="text-xs text-gray-400">{category.products.length}개 매물</span>
      </div>

      {category.products.length === 0 ? (
        <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-400">
          아직 매물이 없어요
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {category.products.map((product) => (
            <ProductCard
              key={product.pid}
              product={product}
              selected={selectedPids.has(product.pid)}
              onToggle={() => onToggle(product.pid, product.price)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
