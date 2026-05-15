'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ──────────────────────────────────────────────────────────────────────────────
// 로컬 타입
// ──────────────────────────────────────────────────────────────────────────────

interface Message {
  id: number
  sender_uid: string
  sender_name: string
  text: string
  created_at: string
}

type RoomInfo =
  | {
      type: 'package'
      room_id: number
      match_id: number
      package_match: {
        status: string
        seller_uid: string
        buyer_uid: string
        package_id: number
        semester: string | null
      }
      counterpart_name: string
      sender_uid: string
    }
  | {
      type: 'product'
      room_id: number
      product_id: string
      product_title: string
      counterpart_name: string
      sender_uid: string
    }

// ──────────────────────────────────────────────────────────────────────────────
// 페이지
// ──────────────────────────────────────────────────────────────────────────────

export default function ChatRoomPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const queryClient = useQueryClient()
  const params = useParams<{ id: string }>()
  const roomId = Number(params.id)

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── 인증 (onAuthStateChange: 쿠키/스토리지에서 세션을 안정적으로 로드) ──
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

  // ── 채팅방 정보 조회 (서버사이드 API 경유 — 서버 JWT로 RLS 확실히 통과) ──
  const { data: roomInfo, isLoading: roomLoading } = useQuery({
    queryKey: ['chat-room', roomId],
    queryFn: async (): Promise<RoomInfo | null> => {
      if (!roomId) return null
      const res = await fetch(`/api/chat/room/${roomId}`)
      if (!res.ok) return null
      const json = await res.json() as { data: RoomInfo | null; error: string | null }
      return json.data
    },
    enabled: !!roomId && !!userId,
  })

  // sender_uid: roomInfo에서 서버 확인된 값 사용
  const effectiveUserId = roomInfo?.sender_uid ?? userId

  // ── 메시지 조회 (서버 API 경유 — chat_messages RLS도 chat_participants 참조)
  // Realtime postgres_changes가 클라이언트 RLS를 통과 못하므로 3초 폴링으로 보완
  const { isLoading: msgsLoading } = useQuery({
    queryKey: ['chat-messages', roomId],
    queryFn: async (): Promise<Message[]> => {
      if (!roomId || !effectiveUserId) return []

      const res = await fetch(`/api/chat/messages/${roomId}`)
      if (!res.ok) return []
      const json = await res.json() as { data: Message[] | null; error: string | null }
      const msgs = json.data ?? []
      setMessages(msgs)
      return msgs
    },
    enabled: !!roomId && !!effectiveUserId,
    refetchInterval: 3000,
  })

  // ── Realtime 메시지 구독 ────────────────────────────────────────────────
  // chat_messages RLS가 chat_participants를 참조해 postgres_changes 이벤트가
  // 클라이언트에 전달되지 않을 수 있으므로, 이벤트 수신 시 API로 전체 재조회.
  useEffect(() => {
    if (!roomId || !effectiveUserId) return

    const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const res = await fetch(`/api/chat/messages/${roomId}`)
          if (!res.ok) return
          const json = await res.json() as { data: Message[] | null; error: string | null }
          const msgs = json.data ?? []
          setMessages(msgs)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, effectiveUserId, supabase])

  // ── 스크롤 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── 메시지 전송 ───────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!roomInfo) throw new Error('채팅방 정보를 불러올 수 없어요')
      const matchId = roomInfo.type === 'package' ? roomInfo.match_id : null

      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, match_id: matchId, content }),
      })

      const result = await res.json()
      if (!res.ok || result.error) throw new Error(result.error?.message ?? '전송 실패')

      queryClient.invalidateQueries({ queryKey: ['chat-room', roomId] })
      return result.data
    },
    onSuccess: (data) => {
      setSendError(null)
      if (effectiveUserId) {
        const optimistic: Message = {
          id: data.message_id,
          sender_uid: effectiveUserId,
          sender_name: '나',
          text: data.original_text ?? '',
          created_at: new Date().toISOString(),
        }
        setMessages((prev) =>
          prev.some((m) => m.id === optimistic.id) ? prev : [...prev, optimistic]
        )
      }
    },
    onError: (err) => {
      setSendError(err instanceof Error ? err.message : '전송 중 오류가 발생했어요')
    },
  })

  // ── 매칭 취소 ─────────────────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!roomInfo || roomInfo.type !== 'package') throw new Error('채팅방 정보 없음')
      const { error } = await supabase
        .from('package_matches')
        .update({ status: 'cancelled' })
        .eq('match_id', roomInfo.match_id)
        .in('status', ['pending', 'matched'])
        .or(`buyer_uid.eq.${effectiveUserId},seller_uid.eq.${effectiveUserId}`)
      if (error) throw error
    },
    onSuccess: () => { router.push('/chat') },
  })

  // ── 거래 완료 ─────────────────────────────────────────────────────────────
  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/matches/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: roomInfo?.type === 'package' ? roomInfo.match_id : null }),
      })
      const result = await res.json()
      if (!res.ok || result.error) throw new Error(result.error?.message ?? '거래 완료 실패')
      return result.data
    },
    onSuccess: () => { router.push('/packages') },
  })

  // ── 핸들러 ────────────────────────────────────────────────────────────────
  const handleSend = () => {
    const text = inputText.trim()
    if (!text || sendMutation.isPending) return
    setInputText('')
    sendMutation.mutate(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── 렌더 분기 ─────────────────────────────────────────────────────────────
  if (authLoading) {
    return <div className="p-8"><p className="text-gray-500">로딩 중...</p></div>
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-sm text-gray-500">로그인 후 채팅을 이용할 수 있어요.</p>
        <Link href="/login" className="px-4 py-2 bg-[#8B0029] text-white text-sm rounded-lg">
          로그인
        </Link>
      </div>
    )
  }

  if (roomLoading || msgsLoading) {
    return <div className="p-8"><p className="text-gray-500">로딩 중...</p></div>
  }

  if (!roomInfo) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500 mb-2">채팅방을 찾을 수 없어요.</p>
        <Link href="/chat" className="text-sm underline text-gray-600">채팅 목록으로</Link>
      </div>
    )
  }

  const isPackageRoom = roomInfo.type === 'package'
  const matchStatus = isPackageRoom ? roomInfo.package_match.status : null
  const isSeller = isPackageRoom ? roomInfo.package_match.seller_uid === effectiveUserId : false
  const isActive = isPackageRoom ? (matchStatus === 'pending' || matchStatus === 'matched') : true

  const STATUS_LABEL: Record<string, string> = {
    pending: '수락 대기 중 🔄',
    matched: '채팅 진행 중 💬',
    completed: '거래 완료 ✅',
    cancelled: '취소됨 ❌',
  }

  return (
    // -mx-4 -my-6 로 레이아웃 padding 탈출
    // header: py-3(24px) + line-height ~32px ≈ 56px, main: py-6(48px) 상단만 제거
    <div className="flex flex-col -mx-4 -my-6 bg-gray-50" style={{ height: 'calc(100dvh - 56px)' }}>
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-3 shrink-0">
        <Link href="/chat" className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors text-gray-500 text-lg">
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base truncate">{roomInfo.counterpart_name}</p>
          {isPackageRoom && (
            <p className="text-sm text-gray-400 truncate mt-0.5">
              {STATUS_LABEL[matchStatus ?? ''] ?? matchStatus}
            </p>
          )}
        </div>
        {isPackageRoom && isActive && (
          <div className="flex gap-2 shrink-0">
            {isSeller && matchStatus === 'matched' && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="text-sm px-3 py-1.5 bg-[#8B0029] text-white rounded-lg hover:bg-[#6B0020] transition-colors"
              >
                거래 완료
              </button>
            )}
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        )}
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">첫 메시지를 보내보세요!</p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isMe={msg.sender_uid === effectiveUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {sendError && <p className="text-sm text-red-500 px-5 pb-1">{sendError}</p>}

      {/* 입력창 */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex gap-3 items-end shrink-0">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isActive ? '메시지를 입력하세요...' : '종료된 채팅방이에요'}
          disabled={!isActive || sendMutation.isPending}
          rows={1}
          className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-base resize-none bg-gray-50 focus:outline-none focus:border-[#8B0029] focus:bg-white transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!isActive || !inputText.trim() || sendMutation.isPending}
          className="shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-[#8B0029] text-white text-lg hover:bg-[#6B0020] transition-colors disabled:opacity-40"
        >
          ↑
        </button>
      </div>

      {showCompleteModal && (
        <Modal
          title="거래를 완료하시겠어요?"
          description={`${roomInfo.counterpart_name}님과의 거래를 완료하면 다른 바이어의 매칭이 자동으로 취소됩니다.`}
          confirmLabel={completeMutation.isPending ? '처리 중...' : '거래 완료'}
          onConfirm={() => { setShowCompleteModal(false); completeMutation.mutate() }}
          onCancel={() => setShowCompleteModal(false)}
        />
      )}
      {showCancelModal && (
        <Modal
          title="매칭을 취소하시겠어요?"
          description="취소하면 이 채팅방을 더 이상 사용할 수 없어요."
          confirmLabel={cancelMutation.isPending ? '처리 중...' : '취소하기'}
          onConfirm={() => { setShowCancelModal(false); cancelMutation.mutate() }}
          onCancel={() => setShowCancelModal(false)}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 메시지 버블
// ──────────────────────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMe }: { msg: Message; isMe: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
      {!isMe && <p className="text-xs text-gray-400 px-2">{msg.sender_name}</p>}
      <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        <div
          className={`max-w-[72vw] sm:max-w-sm px-4 py-3 text-base leading-relaxed shadow-sm whitespace-pre-wrap ${
            isMe
              ? 'bg-[#8B0029] text-white rounded-2xl rounded-br-md'
              : 'bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-100'
          }`}
        >
          {msg.text}
        </div>
        <p className="shrink-0 text-xs text-gray-300 mb-1">
          {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 확인 모달
// ──────────────────────────────────────────────────────────────────────────────

function Modal({ title, description, confirmLabel, onConfirm, onCancel }: {
  title: string; description: string; confirmLabel: string
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full">
        <p className="font-semibold text-sm mb-2">{title}</p>
        <p className="text-xs text-gray-500 mb-6">{description}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border border-gray-200 text-sm rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">닫기</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-[#8B0029] text-white text-sm rounded-lg hover:bg-[#6B0020] transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
