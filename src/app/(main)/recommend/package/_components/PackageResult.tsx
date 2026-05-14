'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { CategoryWithProducts, PackageTemplate } from '@/types/recommend'
import { CategorySection } from './CategorySection'

interface SelectedItem {
  price: number
  seller_uid: string
  category_id: number
}

interface Props {
  template: PackageTemplate
  categories: CategoryWithProducts[]
}

export function PackageResult({ template, categories }: Props) {
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map())
  const [skippedCategories, setSkippedCategories] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // 같은 패키지 내 2개 카테고리 이상에 상품을 올린 판매자
  const multiCategorySellers = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const cat of categories) {
      for (const p of cat.products) {
        if (!p.seller_uid) continue
        if (!map.has(p.seller_uid)) map.set(p.seller_uid, new Set())
        map.get(p.seller_uid)!.add(cat.category_id)
      }
    }
    return new Set(
      [...map.entries()].filter(([, s]) => s.size >= 2).map(([uid]) => uid)
    )
  }, [categories])

  // 현재 선택된 판매자 UID
  const selectedSellerUids = useMemo(
    () => new Set([...selectedItems.values()].map((i) => i.seller_uid)),
    [selectedItems]
  )

  const handleToggle = useCallback(
    (pid: string, price: number, sellerUid: string, categoryId: number) => {
      setSelectedItems((prev) => {
        const next = new Map(prev)
        if (next.has(pid)) {
          next.delete(pid)
        } else {
          next.set(pid, { price, seller_uid: sellerUid, category_id: categoryId })
        }
        return next
      })
    },
    []
  )

  const handleSkip = useCallback((categoryId: number) => {
    setSkippedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
        // 건너뛴 카테고리의 선택 해제
        setSelectedItems((prevItems) => {
          const nextItems = new Map(prevItems)
          for (const [pid, item] of nextItems) {
            if (item.category_id === categoryId) nextItems.delete(pid)
          }
          return nextItems
        })
      }
      return next
    })
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const handleBuy = async () => {
    if (selectedItems.size === 0) return
    setSending(true)
    try {
      // 판매자별 대표 상품 1개씩
      const sellerPidMap = new Map<string, string>()
      for (const [pid, item] of selectedItems) {
        if (!sellerPidMap.has(item.seller_uid)) sellerPidMap.set(item.seller_uid, pid)
      }

      const results = await Promise.allSettled(
        [...sellerPidMap.values()].map((pid) =>
          fetch('/api/chat/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pid }),
          })
        )
      )

      const successCount = results.filter((r) => r.status === 'fulfilled').length
      showToast(`${successCount}명의 판매자에게 연락 완료`)
    } finally {
      setSending(false)
    }
  }

  const totalPrice = [...selectedItems.values()].reduce((s, i) => s + i.price, 0)
  const totalProducts = categories.reduce((s, c) => s + c.products.length, 0)
  const activeCategoryCount = categories.length - skippedCategories.size

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">{template.title}</h2>
        {template.description && (
          <p className="mt-1 text-sm text-gray-500">{template.description}</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          총 {activeCategoryCount}개 카테고리 · 매물 {totalProducts}건
        </p>
        {multiCategorySellers.size > 0 && (
          <p className="mt-1 text-xs text-amber-600">
            ⭐ 여러 카테고리 상품을 동시에 올린 판매자가 {multiCategorySellers.size}명 있어요
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          카드를 눌러 담을 상품을 선택하고, 불필요한 카테고리는 &ldquo;선택 안함&rdquo;으로 건너뛰세요.
        </p>
      </div>

      {/* 카테고리 섹션 */}
      {categories.map((category) => (
        <CategorySection
          key={category.category_id}
          category={category}
          selectedPids={selectedItems}
          onToggle={handleToggle}
          skipped={skippedCategories.has(category.category_id)}
          onSkip={() => handleSkip(category.category_id)}
          multiCategorySellers={multiCategorySellers}
          selectedSellerUids={selectedSellerUids}
        />
      ))}

      {/* 하단 요약 + 구매 버튼 */}
      {selectedItems.size > 0 && (
        <div className="sticky bottom-4 rounded-xl border border-[#8B0029]/20 bg-white shadow-lg px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500">{selectedItems.size}개 상품 선택됨</p>
              <p className="text-xl font-bold text-gray-900">{totalPrice.toLocaleString()}원</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setSelectedItems(new Map()); setSkippedCategories(new Set()) }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                초기화
              </button>
              <button
                onClick={handleBuy}
                disabled={sending}
                className="rounded-lg bg-[#8B0029] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6B0020] transition-colors disabled:opacity-50"
              >
                {sending ? '연락 중...' : '판매자에게 연락하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-4">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
