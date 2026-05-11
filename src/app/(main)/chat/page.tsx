'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'

interface ChatListItem {
  key: string
  room_id: number
  status: string
  subtitle: string
  counterpart_name: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: '수락 대기 중',
  matched: '채팅 진행 중',
  completed: '거래 완료',
  cancelled: '취소됨',
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'text-yellow-600 bg-yellow-50 border-yellow-100',
  matched:   'text-blue-600 bg-blue-50 border-blue-100',
  completed: 'text-green-600 bg-green-50 border-green-100',
  cancelled: 'text-gray-400 bg-gray-50 border-gray-100',
}

export default function ChatListPage() {
  const supabase = createClient()
  const { profile, isLoading: profileLoading } = useExchangeProfile()
  const userId = profile?.uid ?? null

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ['chat-list', userId],
    queryFn: async (): Promise<ChatListItem[]> => {
      if (!userId) return []

      const results: ChatListItem[] = []

      // ── 1. 패키지 채팅방 ──────────────────────────────────────────────────
      const { data: pkgData } = await supabase
        .from('package_matches')
        .select(`
          match_id, status, semester, buyer_uid, seller_uid, package_id,
          essential_packages (name_ko),
          buyer:users!buyer_uid (nickname),
          seller:users!seller_uid (nickname),
          chat_rooms (room_id)
        `)
        .or(`buyer_uid.eq.${userId},seller_uid.eq.${userId}`)
        .in('status', ['pending', 'matched'])
        .order('created_at', { ascending: false })

      for (const m of pkgData ?? []) {
        const rooms = Array.isArray(m.chat_rooms) ? m.chat_rooms : [m.chat_rooms]
        const room = rooms[0] as { room_id: number } | null
        if (!room || m.buyer_uid === m.seller_uid) continue

        const isSeller = m.seller_uid === userId
        const buyerNickname = Array.isArray(m.buyer)
          ? (m.buyer[0] as { nickname: string } | undefined)?.nickname
          : (m.buyer as { nickname: string } | null)?.nickname
        const sellerNickname = Array.isArray(m.seller)
          ? (m.seller[0] as { nickname: string } | undefined)?.nickname
          : (m.seller as { nickname: string } | null)?.nickname
        const packageRow = Array.isArray(m.essential_packages)
          ? (m.essential_packages[0] as { name_ko: string } | undefined)
          : (m.essential_packages as { name_ko: string } | null)

        results.push({
          key: `pkg-${m.match_id}`,
          room_id: room.room_id,
          status: m.status,
          subtitle: packageRow?.name_ko ?? `패키지 #${m.package_id}`,
          counterpart_name: isSeller ? (buyerNickname ?? '알 수 없음') : (sellerNickname ?? '알 수 없음'),
        })
      }

      // ── 2. 상품 채팅방 ────────────────────────────────────────────────────
      const { data: prodRooms } = await supabase
        .from('chat_rooms')
        .select(`
          room_id,
          product_id,
          products (title),
          chat_participants!inner (uid, users!uid (nickname))
        `)
        .not('product_id', 'is', null)
        .eq('chat_participants.uid', userId)

      for (const r of prodRooms ?? []) {
        const product = Array.isArray(r.products) ? r.products[0] : r.products
        const participants = (Array.isArray(r.chat_participants)
          ? r.chat_participants
          : [r.chat_participants]) as unknown as { uid: string; users: { nickname: string } | null }[]
        const counterpart = participants.find((p) => p.uid !== userId)

        results.push({
          key: `prod-${r.room_id}`,
          room_id: r.room_id,
          status: 'active',
          subtitle: (product as { title: string } | null)?.title ?? '상품',
          counterpart_name: counterpart?.users?.nickname ?? '알 수 없음',
        })
      }

      return results
    },
    enabled: !!userId,
  })

  if (profileLoading || isLoading) {
    return <p className="text-sm text-gray-400">불러오는 중...</p>
  }

  if (!userId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-600 mb-4">로그인 후 채팅 목록을 확인할 수 있어요.</p>
        <Link href="/login" className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          로그인
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">채팅 목록</h1>

      {chats.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">진행 중인 채팅이 없어요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {chats.map((chat) => (
            <Link
              key={chat.key}
              href={`/chat/${chat.room_id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 hover:border-indigo-300 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900">{chat.counterpart_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{chat.subtitle}</p>
              </div>
              {chat.status !== 'active' && (
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[chat.status] ?? 'text-gray-500'}`}>
                  {STATUS_LABEL[chat.status] ?? chat.status}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
