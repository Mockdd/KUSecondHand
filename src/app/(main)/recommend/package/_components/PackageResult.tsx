'use client'

import { useState } from 'react'
import { CategoryWithProducts, PackageTemplate } from '@/types/recommend'
import { CategorySection } from './CategorySection'

interface Props {
  template: PackageTemplate
  categories: CategoryWithProducts[]
}

export function PackageResult({ template, categories }: Props) {
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map())
  const totalProducts = categories.reduce((sum, c) => sum + c.products.length, 0)

  const handleToggle = (pid: string, price: number) => {
    setSelectedItems(prev => {
      const next = new Map(prev)
      if (next.has(pid)) {
        next.delete(pid)
      } else {
        next.set(pid, price)
      }
      return next
    })
  }

  const totalPrice = Array.from(selectedItems.values()).reduce((sum, p) => sum + p, 0)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">{template.title}</h2>
        {template.description && (
          <p className="mt-1 text-sm text-gray-500">{template.description}</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          총 {categories.length}개 카테고리 · 매물 {totalProducts}건
        </p>
        <p className="mt-1 text-xs text-gray-400">
          카드를 눌러 담고 싶은 항목을 선택하세요.
        </p>
      </div>

      {categories.map((category) => (
        <CategorySection
          key={category.category_id}
          category={category}
          selectedPids={selectedItems}
          onToggle={handleToggle}
        />
      ))}

      {selectedItems.size > 0 && (
        <div className="rounded-xl border border-[#8B0029]/20 bg-[#FDF2F4] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#8B0029]">{selectedItems.size}개 선택됨</p>
              <p className="text-xl font-bold text-[#8B0029]">{totalPrice.toLocaleString()}원</p>
            </div>
            <button
              onClick={() => setSelectedItems(new Map())}
              className="rounded-lg border border-[#8B0029]/40 bg-white px-3 py-1.5 text-xs font-medium text-[#8B0029] hover:bg-[#8B0029] hover:text-white transition-colors"
            >
              선택 초기화
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
