'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'
import type { LanguagePrefEnum } from '@/types/supabase'

// ──────────────────────────────────────────────────────────────────────────────
// 로컬 타입
// ──────────────────────────────────────────────────────────────────────────────

interface Message {
  id: number
  sender_uid: string
  sender_name: string
  original_text: string
  translated_text: string | null
  source_lang: string
  target_lang: string
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
    }
  | {
      type: 'product'
      room_id: number
      product_id: string
      product_title: string
      counterpart_name: string
    }

// ──────────────────────────────────────────────────────────────────────────────
// 페이지
// ──────────────────────────────────────────────────────────────────────────────

export default function ChatRoomPage() {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()
  const params = useParams<{ id: string }>()
  const roomId = Number(params.id)

  const { profile, isLoading: profileLoading } = useExchangeProfile()
  const userId = profile?.uid ?? null
  const myLang: LanguagePrefEnum = profile?.language_pref ?? 'ko'

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [showTranslation, setShowTranslation] = useState(true)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── mock 모드 (미로그인 개발 미리보기) ──────────────────────────────────
  const isMock = !userId
  const displayMessages: Message[] = isMock
    ? (MOCK_MESSAGES[roomId] ?? [])
    : messages
  const displayUserId = isMock ? 'mock-me' : userId

  // ── 채팅방 정보 조회 ──────────────────────────────────────────────────────
  const { data: roomInfo, isLoading: roomLoading } = useQuery({
    queryKey: ['chat-room', roomId],
    queryFn: async (): Promise<RoomInfo | null> => {
      if (!roomId || !userId) return null

      const { data: room, error } = await supabase
        .from('chat_rooms')
        .select(`
          room_id,
          product_id,
          package_match_id,
          products (title, seller_uid),
          package_matches (
            match_id, status, seller_uid, buyer_uid, package_id, semester
          ),
          chat_participants (uid, users!uid (nickname))
        `)
        .eq('room_id', roomId)
        .single()

      if (error || !room) return null

      // ── 상품 채팅방 ──────────────────────────────────────────────────────
      if (room.product_id) {
        const product = Array.isArray(room.products) ? room.products[0] : room.products
        const participants = (Array.isArray(room.chat_participants)
          ? room.chat_participants
          : [room.chat_participants]) as unknown as { uid: string; users: { nickname: string } | null }[]
        const counterpart = participants.find((p) => p.uid !== userId)
        return {
          type: 'product',
          room_id: room.room_id,
          product_id: room.product_id,
          product_title: (product as { title: string } | null)?.title ?? '상품',
          counterpart_name: counterpart?.users?.nickname ?? '알 수 없음',
        }
      }

      // ── 패키지 채팅방 ─────────────────────────────────────────────────────
      const match = Array.isArray(room.package_matches)
        ? room.package_matches[0]
        : room.package_matches
      if (!match) return null

      const counterpartUid = match.seller_uid === userId ? match.buyer_uid : match.seller_uid
      const { data: userRow } = await supabase
        .from('users')
        .select('nickname')
        .eq('uid', counterpartUid)
        .single()

      return {
        type: 'package',
        room_id: room.room_id,
        match_id: match.match_id,
        package_match: {
          status: match.status,
          seller_uid: match.seller_uid,
          buyer_uid: match.buyer_uid,
          package_id: match.package_id,
          semester: match.semester,
        },
        counterpart_name: userRow?.nickname ?? '알 수 없음',
      }
    },
    enabled: !!roomId && !profileLoading && !!userId,
  })

  const displayRoomInfo: RoomInfo | null | undefined = isMock
    ? (MOCK_ROOMS[roomId] ?? MOCK_ROOMS[1] ?? null)
    : roomInfo

  // ── 메시지 초기 조회 ──────────────────────────────────────────────────────
  const { isLoading: msgsLoading } = useQuery({
    queryKey: ['chat-messages', roomId],
    queryFn: async (): Promise<Message[]> => {
      if (!roomId || !userId) return []

      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          sender_uid,
          original_text,
          translated_text,
          source_lang,
          target_lang,
          created_at,
          users!sender_uid (nickname)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })

      if (error || !data) return []

      const msgs = data.map((m) => ({
        id: m.id,
        sender_uid: m.sender_uid,
        sender_name:
          (Array.isArray(m.users)
            ? (m.users[0] as { nickname: string } | undefined)?.nickname
            : (m.users as { nickname: string } | null)?.nickname) ?? '알 수 없음',
        original_text: m.original_text,
        translated_text: m.translated_text,
        source_lang: m.source_lang,
        target_lang: m.target_lang,
        created_at: m.created_at,
      }))

      setMessages(msgs)
      return msgs
    },
    enabled: !!roomId && !profileLoading && !!userId,
  })

  // ── 읽음 처리 (채팅방 진입 시) ──────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return
    supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('uid', userId)
      .then(() => {})
  }, [roomId, userId, supabase])

  // ── Realtime 메시지 구독 ────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return

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
        async (payload) => {
          const newRow = payload.new as {
            id: number
            sender_uid: string
            original_text: string
            translated_text: string | null
            source_lang: string
            target_lang: string
            created_at: string
          }

          // 이미 있는 메시지면 스킵 (optimistic add와 중복 방지)
          setMessages((prev) => {
            if (prev.some((m) => m.id === newRow.id)) return prev

            // 발신자 이름 조회 후 추가 (비동기)
            supabase
              .from('users')
              .select('nickname')
              .eq('uid', newRow.sender_uid)
              .single()
              .then(({ data: u }) => {
                setMessages((p) => {
                  if (p.some((m) => m.id === newRow.id)) return p
                  return [
                    ...p,
                    {
                      id: newRow.id,
                      sender_uid: newRow.sender_uid,
                      sender_name: u?.nickname ?? '알 수 없음',
                      original_text: newRow.original_text,
                      translated_text: newRow.translated_text,
                      source_lang: newRow.source_lang,
                      target_lang: newRow.target_lang,
                      created_at: newRow.created_at,
                    },
                  ]
                })
              })

            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase])

  // ── 새 메시지 시 스크롤 하단 이동 ─────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── 메시지 전송 mutation ──────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!roomInfo) throw new Error('채팅방 정보를 불러올 수 없어요')

      const targetLang: LanguagePrefEnum = myLang === 'ko' ? 'en' : 'ko'
      const matchId = roomInfo.type === 'package' ? roomInfo.match_id : null

      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          match_id: matchId,
          content,
          source_lang: myLang,
          target_lang: targetLang,
        }),
      })

      const result = await res.json()
      if (!res.ok || result.error) {
        throw new Error(result.error?.message ?? '전송 실패')
      }

      // 매칭 상태 캐시 갱신
      queryClient.invalidateQueries({ queryKey: ['chat-room', roomId] })
      return result.data
    },
    onSuccess: (data) => {
      setSendError(null)
      // 낙관적 메시지 추가 (Realtime 도착 전 즉시 표시)
      if (userId) {
        const optimistic: Message = {
          id: data.message_id,
          sender_uid: userId,
          sender_name: profile?.uid ?? '나',
          original_text: data.original_text,
          translated_text: data.translated_text,
          source_lang: data.source_lang,
          target_lang: data.target_lang,
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

  // ── 매칭 취소 mutation ────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!roomInfo || roomInfo.type !== 'package') throw new Error('채팅방 정보 없음')
      const { error } = await supabase
        .from('package_matches')
        .update({ status: 'cancelled' })
        .eq('match_id', roomInfo.match_id)
        .in('status', ['pending', 'matched'])
        .or(`buyer_uid.eq.${userId},seller_uid.eq.${userId}`)

      if (error) throw error
    },
    onSuccess: () => {
      router.push('/chat')
    },
  })

  // ── 거래 완료 mutation (셀러) → /api/matches/complete ─────────────────
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
    onSuccess: () => {
      router.push('/packages')
    },
  })

  // ── 핸들러 ────────────────────────────────────────────────────────────
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

  // ── 로딩 ──────────────────────────────────────────────────────────────
  if (profileLoading || (!isMock && (roomLoading || msgsLoading))) {
    return (
      <div className="p-8">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  if (!displayRoomInfo) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500 mb-2">채팅방을 찾을 수 없어요.</p>
        <Link href="/chat" className="text-sm underline text-gray-600">채팅 목록으로</Link>
      </div>
    )
  }

  const isPackageRoom = displayRoomInfo.type === 'package'
  const matchStatus = isPackageRoom ? displayRoomInfo.package_match.status : null
  const isSeller = isPackageRoom ? displayRoomInfo.package_match.seller_uid === displayUserId : false
  const isActive = isPackageRoom ? (matchStatus === 'pending' || matchStatus === 'matched') : true

  const STATUS_LABEL: Record<string, string> = {
    pending: '수락 대기 중 🔄',
    matched: '채팅 진행 중 💬',
    completed: '거래 완료 ✅',
    cancelled: '취소됨 ❌',
  }

  // ── 정상 ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen">
      {/* 헤더 */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Link href="/chat" className="text-gray-400 text-sm">←</Link>
            <p className="font-medium text-sm">{displayRoomInfo.counterpart_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 번역 토글 */}
            <button
              onClick={() => setShowTranslation((v) => !v)}
              className={`text-xs px-2 py-1 rounded border ${
                showTranslation
                  ? 'border-blue-300 text-blue-600 bg-blue-50'
                  : 'border-gray-300 text-gray-500'
              }`}
            >
              {showTranslation ? '번역 ON' : '번역 OFF'}
            </button>
          </div>
        </div>

        {/* 서브 정보 */}
        <p className="text-xs text-gray-400 ml-6">
          {isPackageRoom
            ? (STATUS_LABEL[matchStatus ?? ''] ?? matchStatus)
            : displayRoomInfo.product_title}
        </p>

        {/* 패키지 채팅방 액션 버튼 */}
        {isPackageRoom && isActive && (
          <div className="flex gap-2 mt-2 ml-6">
            {isSeller && matchStatus === 'matched' && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="text-xs px-2 py-1 bg-black text-white rounded"
              >
                거래 완료
              </button>
            )}
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-xs px-2 py-1 border border-gray-300 rounded text-gray-600"
            >
              매칭 취소
            </button>
          </div>
        )}
      </div>

      {/* 개발 미리보기 배너 */}
      {isMock && (
        <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-1.5">
          <p className="text-xs text-yellow-700">개발 미리보기 — 실제 데이터 아님</p>
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {displayMessages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">
            첫 메시지를 보내보세요!
          </p>
        )}
        {displayMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isMe={msg.sender_uid === displayUserId}
            showTranslation={showTranslation}
            myLang={myLang}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 에러 */}
      {sendError && (
        <p className="text-xs text-red-500 px-4 pb-1">{sendError}</p>
      )}

      {/* 입력창 */}
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isMock ? '로그인 후 메시지를 보낼 수 있어요' : isActive ? '메시지를 입력하세요...' : '종료된 채팅방이에요'}
          disabled={isMock || !isActive || sendMutation.isPending}
          rows={1}
          className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm resize-none disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          onClick={handleSend}
          disabled={isMock || !isActive || !inputText.trim() || sendMutation.isPending}
          className="px-4 py-2 bg-black text-white text-sm rounded disabled:opacity-40"
        >
          전송
        </button>
      </div>

      {/* 거래 완료 모달 */}
      {showCompleteModal && (
        <Modal
          title="거래를 완료하시겠어요?"
          description={`${displayRoomInfo.counterpart_name}님과의 거래를 완료하면 다른 바이어의 매칭이 자동으로 취소됩니다.`}
          confirmLabel={completeMutation.isPending ? '처리 중...' : '거래 완료'}
          onConfirm={() => {
            setShowCompleteModal(false)
            if (!isMock) completeMutation.mutate()
          }}
          onCancel={() => setShowCompleteModal(false)}
        />
      )}

      {/* 매칭 취소 모달 */}
      {showCancelModal && (
        <Modal
          title="매칭을 취소하시겠어요?"
          description="취소하면 이 채팅방을 더 이상 사용할 수 없어요."
          confirmLabel={cancelMutation.isPending ? '처리 중...' : '취소하기'}
          onConfirm={() => {
            setShowCancelModal(false)
            if (!isMock) cancelMutation.mutate()
          }}
          onCancel={() => setShowCancelModal(false)}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 메시지 버블
// ──────────────────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: Message
  isMe: boolean
  showTranslation: boolean
  myLang: LanguagePrefEnum
}

function MessageBubble({ msg, isMe, showTranslation, myLang }: MessageBubbleProps) {
  // 내가 받은 메시지에서 번역을 표시할지 결정
  // - 내 메시지: 내가 보낸 원문 표시
  // - 상대 메시지: showTranslation ON 이면 translated_text (내 언어), OFF 이면 original_text
  const displayText = isMe
    ? msg.original_text
    : showTranslation && msg.translated_text
    ? msg.translated_text
    : msg.original_text

  const showOriginalToggle =
    !isMe && showTranslation && msg.translated_text && msg.translated_text !== msg.original_text

  return (
    <div className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
      {!isMe && (
        <p className="text-xs text-gray-400 px-1">{msg.sender_name}</p>
      )}
      <div
        className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
          isMe
            ? 'bg-black text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}
      >
        <p>{displayText}</p>
        {showOriginalToggle && (
          <p className="text-xs mt-1 opacity-60 border-t border-gray-300 pt-1">
            {msg.original_text}
          </p>
        )}
      </div>
      <p className="text-xs text-gray-300 px-1">
        {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 확인 모달
// ──────────────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock 데이터 (개발 미리보기)
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_ROOMS: Record<number, RoomInfo> = {
  1: {
    type: 'package',
    room_id: 1,
    match_id: 1,
    package_match: { status: 'pending', seller_uid: 'mock-emma', buyer_uid: 'mock-me', package_id: 1, semester: '2026-1' },
    counterpart_name: 'Emma Müller',
  },
  2: {
    type: 'package',
    room_id: 2,
    match_id: 2,
    package_match: { status: 'matched', seller_uid: 'mock-me', buyer_uid: 'mock-lucas', package_id: 1, semester: '2026-1' },
    counterpart_name: 'Lucas Park',
  },
}

const MOCK_MESSAGES: Record<number, Message[]> = {
  // room 1 (바이어 뷰): 아직 메시지 없음 — 수락 대기 중
  1: [],
  // room 2 (셀러 뷰): Lucas(바이어)가 먼저 영어로, 나(셀러)가 한국어로 답장
  2: [
    {
      id: 1,
      sender_uid: 'mock-lucas',
      sender_name: 'Lucas Park',
      original_text: 'Hi, is the package still available?',
      translated_text: '안녕하세요, 패키지 아직 있나요?',
      source_lang: 'en',
      target_lang: 'ko',
      created_at: '2026-05-07T10:00:00Z',
    },
    {
      id: 2,
      sender_uid: 'mock-me',
      sender_name: '나',
      original_text: '네, 있어요! 언제 받으실 건가요?',
      translated_text: 'Yes, it is! When would you like to pick it up?',
      source_lang: 'ko',
      target_lang: 'en',
      created_at: '2026-05-07T10:01:00Z',
    },
    {
      id: 3,
      sender_uid: 'mock-lucas',
      sender_name: 'Lucas Park',
      original_text: 'I can come this Saturday afternoon.',
      translated_text: '이번 주 토요일 오후에 갈 수 있어요.',
      source_lang: 'en',
      target_lang: 'ko',
      created_at: '2026-05-07T10:02:00Z',
    },
  ],
}

function Modal({ title, description, confirmLabel, onConfirm, onCancel }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full">
        <p className="font-semibold text-sm mb-2">{title}</p>
        <p className="text-xs text-gray-500 mb-6">{description}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-sm rounded"
          >
            닫기
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-black text-white text-sm rounded"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
