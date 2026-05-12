'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  pid: string
  sellerUid: string
}

export function ChatButton({ pid, sellerUid: _sellerUid }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/chat/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid }),
      })
      const json = await res.json() as { room_id?: number; error?: string }

      if (!res.ok) {
        throw new Error(json.error ?? '채팅방 생성에 실패했어요')
      }

      router.push(`/chat/${json.room_id}`)
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
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? '연결 중...' : '채팅하기'}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
