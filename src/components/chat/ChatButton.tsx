'use client'

import { useState } from 'react'

interface Props {
  pid: string
  sellerUid: string
  productTitle?: string
}

export function ChatButton({ pid, sellerUid: _sellerUid, productTitle }: Props) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/chat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, ...(productTitle ? { product_titles: [productTitle] } : {}) }),
      })
      const json = await res.json() as { room_id?: number; error?: string }

      if (!res.ok) {
        throw new Error(json.error ?? '채팅방 생성에 실패했어요')
      }

      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했어요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading || sent}
        className="w-full rounded-lg bg-[#8B0029] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d0021] disabled:opacity-50 transition-colors"
      >
        {sent ? '구매 의사 전달됐어요 ✓' : loading ? '전달 중...' : '구매할래요'}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
