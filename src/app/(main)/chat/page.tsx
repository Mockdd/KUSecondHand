'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ChatListItem {
  key: string
  room_id: number
  status: string
  subtitle: string
  counterpart_name: string
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

const STATUS_LABEL: Record<string, string> = {
  pending: '수락 대기 중',
  matched: '진행 중',
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-yellow-400',
  matched: 'bg-blue-400',
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}시간 전`
  return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

function InitialAvatar({ name }: { name: string }) {
  const initial = name.slice(0, 1).toUpperCase()
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#8B0029]/10 text-base font-bold text-[#8B0029]">
      {initial}
    </div>
  )
}

function ChatItem({ chat }: { chat: ChatListItem }) {
  const dotColor = STATUS_DOT[chat.status]
  const hasUnread = chat.unread_count > 0

  return (
    <Link
      href={`/chat/${chat.room_id}`}
      className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm transition-all hover:border-[#8B0029]/30 hover:shadow-md active:scale-[0.99] sm:px-5"
    >
      {/* 아바타 */}
      <div className="relative">
        <InitialAvatar name={chat.counterpart_name} />
        {dotColor && !hasUnread && (
          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${dotColor}`} />
        )}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#8B0029] text-[10px] font-bold text-white">
            {chat.unread_count > 99 ? '99+' : chat.unread_count}
          </span>
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-base ${hasUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>
            {chat.counterpart_name}
          </p>
          <p className={`shrink-0 text-xs ${hasUnread ? 'font-semibold text-[#8B0029]' : 'text-gray-400'}`}>
            {formatTime(chat.last_message_at)}
          </p>
        </div>
        <p className="mt-0.5 truncate text-xs font-medium text-[#8B0029]/70">
          {chat.subtitle}
        </p>
        <p className={`mt-1 truncate text-sm ${hasUnread ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
          {chat.last_message ?? '메시지를 보내보세요'}
        </p>
      </div>

      {/* 상태 뱃지 */}
      {STATUS_LABEL[chat.status] && !hasUnread && (
        <span className="shrink-0 rounded-full bg-gray-50 border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-500">
          {STATUS_LABEL[chat.status]}
        </span>
      )}

      {/* 화살표 */}
      <span className={`shrink-0 text-sm transition-colors ${hasUnread ? 'text-[#8B0029]' : 'text-gray-300 group-hover:text-[#8B0029]'}`}>›</span>
    </Link>
  )
}

export default function ChatListPage() {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ['chat-list', userId],
    queryFn: async (): Promise<ChatListItem[]> => {
      if (!userId) return []
      const res = await fetch('/api/chat/list')
      if (!res.ok) return []
      const json = await res.json() as { data: ChatListItem[] | null; error: string | null }
      return json.data ?? []
    },
    enabled: !!userId,
    staleTime: 0,
  })

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('chat-list-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-list', userId] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase, queryClient])

  if (authLoading || isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-gray-100" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-4 py-4 sm:px-5">
            <div className="h-12 w-12 animate-pulse rounded-full bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#8B0029]/10 text-2xl">
          💬
        </div>
        <p className="font-semibold text-gray-800">로그인이 필요해요</p>
        <p className="mt-1 mb-6 text-sm text-gray-400">채팅 목록을 확인하려면 로그인하세요.</p>
        <Link
          href="/login"
          className="rounded-xl bg-[#8B0029] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#6B0020] transition-colors"
        >
          로그인
        </Link>
      </div>
    )
  }

  const activeChats = chats.filter((c) => c.status === 'active' || c.status === 'matched' || c.status === 'pending')

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <h1 className="text-2xl font-bold text-gray-900">채팅</h1>

      {activeChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
            💬
          </div>
          <p className="font-semibold text-gray-700">진행 중인 채팅이 없어요</p>
          <p className="mt-1 text-sm text-gray-400">상품 페이지에서 채팅하기를 눌러보세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeChats.map((chat) => (
            <ChatItem key={chat.key} chat={chat} />
          ))}
        </div>
      )}
    </div>
  )
}
