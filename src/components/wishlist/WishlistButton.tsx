'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Props {
  pid: string
}

export function WishlistButton({ pid }: Props) {
  const queryClient = useQueryClient()

  const { data: wishlisted = false } = useQuery({
    queryKey: ['wishlist-status', pid],
    queryFn: async () => {
      const res = await fetch('/api/wishlists')
      if (!res.ok) return false
      const json = await res.json()
      return (json.wishlists as { pid: string }[]).some((w) => w.pid === pid)
    },
  })

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/wishlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid }),
      })
      if (!res.ok) throw new Error('찜 추가 실패')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-status', pid] })
      queryClient.invalidateQueries({ queryKey: ['product-wishlists'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/wishlists/${pid}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('찜 삭제 실패')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-status', pid] })
      queryClient.invalidateQueries({ queryKey: ['product-wishlists'] })
    },
  })

  const isPending = addMutation.isPending || removeMutation.isPending

  return (
    <button
      onClick={() => (wishlisted ? removeMutation.mutate() : addMutation.mutate())}
      disabled={isPending}
      aria-label={wishlisted ? '찜 해제' : '찜하기'}
      className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
        wishlisted
          ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
      }`}
    >
      <span className="text-base">{wishlisted ? '♥' : '♡'}</span>
      {wishlisted ? '찜 해제' : '찜하기'}
    </button>
  )
}
