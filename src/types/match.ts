import { type Database } from './supabase'
import { type LanguagePref } from './exchange'

// ──────────────────────────────────────────────────────────────────────────────
// DB Row 타입 별칭
// ──────────────────────────────────────────────────────────────────────────────

export type PackageMatchRow =
  Database['public']['Tables']['package_matches']['Row']
export type ChatRoomRow = Database['public']['Tables']['chat_rooms']['Row']
export type ChatParticipantRow =
  Database['public']['Tables']['chat_participants']['Row']
export type ChatMessageRow =
  Database['public']['Tables']['chat_messages']['Row']
export type HygieneCertificationRow =
  Database['public']['Tables']['hygiene_certifications']['Row']

// ──────────────────────────────────────────────────────────────────────────────
// ENUM 타입
// ──────────────────────────────────────────────────────────────────────────────

export type MatchStatus = 'pending' | 'matched' | 'completed' | 'cancelled'
export type HygieneCertStatus = 'pending' | 'approved' | 'rejected'

// ──────────────────────────────────────────────────────────────────────────────
// 패키지 매칭
// ──────────────────────────────────────────────────────────────────────────────

export interface PackageMatch {
  match_id: number
  package_id: number
  buyer_uid: string
  seller_uid: string
  status: MatchStatus
  semester: string | null
  created_at: string
  updated_at: string
}

/** 목록 조회용 — 상대방 이름, 채팅방 ID 포함 */
export interface PackageMatchSummary {
  match_id: number
  status: MatchStatus
  package_name: string
  /** 현재 사용자 기준 거래 상대방 이름 */
  counterpart_name: string
  room_id: number | null
  semester: string | null
}

/** 바이어 입장 상세 조회 결과 */
export interface PackageMatchDetailBuyer {
  view_type: 'buyer'
  package_id: number
  template_type: string
  seller: {
    uid: string
    nickname: string
    manner_temperature: number
  }
  owned_count: number
  total_count: number
  match_status: MatchStatus
  already_requested: boolean
  room_id: number | null
}

/** 셀러 입장 상세 조회 결과 */
export interface PackageMatchDetailSeller {
  view_type: 'seller'
  package_id: number
  template_type: string
  buyers: Array<{
    match_id: number
    buyer_uid: string
    buyer_name: string
    match_status: MatchStatus
    room_id: number | null
    overlap_count: number
  }>
  owned_count: number
  total_count: number
  is_postable: boolean
}

// ──────────────────────────────────────────────────────────────────────────────
// 세탁 인증
// ──────────────────────────────────────────────────────────────────────────────

export interface HygieneCertification {
  cert_id: number
  seller_uid: string
  category_id: number
  image_url: string
  status: HygieneCertStatus
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

/** 카테고리명을 JOIN한 세탁 인증 (목록 조회용) */
export interface HygieneCertificationWithCategory extends HygieneCertification {
  category_name: string
}

// ──────────────────────────────────────────────────────────────────────────────
// 채팅방
// ──────────────────────────────────────────────────────────────────────────────

export interface ChatRoom {
  room_id: number
  product_id: string | null
  package_match_id: number | null
  created_at: string
  deleted_at: string | null
}

export interface ChatParticipant {
  id: number
  room_id: number
  uid: string
  last_read_at: string | null
  created_at: string
}

// ──────────────────────────────────────────────────────────────────────────────
// 채팅 메시지
// ──────────────────────────────────────────────────────────────────────────────

export interface ChatMessageData {
  type: 'text' | 'image' | 'system'
  content: string
}

export interface ChatMessage {
  id: number
  room_id: number
  sender_uid: string
  data: ChatMessageData
  original_text: string
  translated_text: string | null
  source_lang: LanguagePref
  target_lang: LanguagePref
  created_at: string
}

/** 화면 표시용 — 발신자 이름, 본인 여부 포함 */
export interface ChatMessageDisplay extends ChatMessage {
  sender_name: string
  is_mine: boolean
  /** 번역 토글 시 표시할 텍스트 (null이면 번역 실패) */
  display_text: string
  show_translation: boolean
}

// ──────────────────────────────────────────────────────────────────────────────
// 메시지 전송 요청 (Edge Function)
// ──────────────────────────────────────────────────────────────────────────────

export interface SendMessageRequest {
  room_id: number
  match_id: number
  content: string
  source_lang: LanguagePref
  target_lang: LanguagePref
}

export interface SendMessageResponse {
  message_id: number
  original_text: string
  translated_text: string | null
  source_lang: LanguagePref
  target_lang: LanguagePref
}
