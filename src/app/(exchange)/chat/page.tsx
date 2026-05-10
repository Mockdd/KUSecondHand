'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'

// ──────────────────────────────────────────────────────────────────────────────
// 로컬 타입
// ──────────────────────────────────────────────────────────────────────────────

interface ChatListItem {
  match_id: number
  room_id: number
  status: string
  semester: string | null
  package_name: string
  counterpart_uid: string
  counterpart_name: string
  is_seller: boolean
}

const STATUS_LABEL: Record<string, string> = {
  pending: '수락 대기 중',
  matched: '채팅 진행 중',
  completed: '거래 완료',
  cancelled: '취소됨',
}

// ──────────────────────────────────────────────────────────────────────────────
// 페이지
// ──────────────────────────────────────────────────────────────────────────────

export default function ChatListPage() {
  const supabase = createClient()
  const { profile, isLoading: profileLoading } = useExchangeProfile()
  const userId = profile?.uid ?? null

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ['chat-list', userId],
    queryFn: async (): Promise<ChatListItem[]> => {
      if (!userId) return []

      const { data, error } = await supabase
        .from('package_matches')
        .select(`
          match_id,
          status,
          semester,
          buyer_uid,
          seller_uid,
          package_id,
          essential_packages (name_ko, name_en),
          buyer:users!buyer_uid (nickname),
          seller:users!seller_uid (nickname),
          chat_rooms (room_id)
        `)
        .or(`buyer_uid.eq.${userId},seller_uid.eq.${userId}`)
        .in('status', ['pending', 'matched'])
        .order('created_at', { ascending: false })

      if (error || !data) return []

      return data
        .map((m) => {
          const rooms = Array.isArray(m.chat_rooms) ? m.chat_rooms : [m.chat_rooms]
          const room = rooms[0] as { room_id: number } | null
          if (!room) return null

          const isSeller = m.seller_uid === userId
          const counterpartUid = isSeller ? m.buyer_uid : m.seller_uid

          // buyer_uid = seller_uid (셀러 초기 등록 행) 제외
          if (m.buyer_uid === m.seller_uid) return null

          const buyerNickname = Array.isArray(m.buyer)
            ? (m.buyer[0] as { nickname: string } | undefined)?.nickname
            : (m.buyer as { nickname: string } | null)?.nickname
          const sellerNickname = Array.isArray(m.seller)
            ? (m.seller[0] as { nickname: string } | undefined)?.nickname
            : (m.seller as { nickname: string } | null)?.nickname

          const counterpartName = isSeller
            ? (buyerNickname ?? '알 수 없음')
            : (sellerNickname ?? '알 수 없음')

          const packageRow = Array.isArray(m.essential_packages)
            ? (m.essential_packages[0] as { name_ko: string } | undefined)
            : (m.essential_packages as { name_ko: string } | null)

          const packageName = packageRow?.name_ko ?? `패키지 #${m.package_id}`

          return {
            match_id: m.match_id,
            room_id: room.room_id,
            status: m.status,
            semester: m.semester,
            package_name: packageName,
            counterpart_uid: counterpartUid,
            counterpart_name: counterpartName,
            is_seller: isSeller,
          }
        })
        .filter((item): item is ChatListItem => item !== null)
    },
    enabled: !!userId,
  })

  // ── 로딩 ─────────────────────────────────────────────────────────────────
  if (profileLoading || isLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  const displayChats = !userId ? MOCK_CHATS : chats

  // ── 정상 ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/" className="text-gray-400 text-sm">←</Link>
        <h1 className="text-xl font-bold">채팅 목록</h1>
      </div>

      {!userId && (
        <div className="border border-yellow-300 bg-yellow-50 rounded p-2 mb-4">
          <p className="text-xs text-yellow-700">개발 미리보기 — 실제 데이터 아님</p>
        </div>
      )}

      {/* 목록 */}
      {displayChats.length === 0 ? (
        <p className="text-sm text-gray-400">진행 중인 채팅이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {displayChats.map((chat) => (
            <Link
              key={`${chat.match_id}-${chat.room_id}`}
              href={`/chat/${chat.room_id}`}
              className="border border-gray-200 rounded p-4 hover:border-gray-400 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{chat.counterpart_name}</p>
                <span className="text-xs text-gray-400">
                  {STATUS_LABEL[chat.status] ?? chat.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">{chat.package_name}</p>
              {chat.semester && (
                <p className="text-xs text-gray-400 mt-1">{chat.semester}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const MOCK_CHATS: ChatListItem[] = [
  { match_id: 1, room_id: 1, status: 'pending', semester: '2026-1', package_name: '기숙사 기본 패키지', counterpart_uid: 'mock-emma',  counterpart_name: 'Emma Müller', is_seller: false },
  { match_id: 2, room_id: 2, status: 'matched', semester: '2026-1', package_name: '기숙사 기본 패키지', counterpart_uid: 'mock-lucas', counterpart_name: 'Lucas Park',  is_seller: true  },
]
