/**
 * Supabase DB 타입 정의
 * schema.sql 기반으로 수동 정의 — 추후 Supabase CLI로 자동 생성 가능
 *
 * 사용법:
 *   createBrowserClient<Database>(url, key)
 *   createServerClient<Database>(url, key, { cookies })
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ──────────────────────────────────────────────────────────────────────────────
// ENUM 타입
// ──────────────────────────────────────────────────────────────────────────────

export type HousingTypeEnum = 'dorm' | 'flat'
export type ExchangeRoleEnum = 'incoming' | 'outgoing'
export type LanguagePrefEnum = 'ko' | 'en'
export type MatchStatusEnum = 'pending' | 'matched' | 'completed' | 'cancelled'
export type CertStatusEnum = 'pending' | 'approved' | 'rejected'
export type ListingStatusEnum = 'selling' | 'reserved' | 'sold'
export type TemplateTypeEnum = 'DORM_BASIC' | 'FLAT_FULL' | 'INCOMING_DORM'

// ──────────────────────────────────────────────────────────────────────────────
// DATABASE 타입
// ──────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      // ── 사용자 ──────────────────────────────────────────────────────────────
      users: {
        Row: {
          uid: string
          nickname: string
          manner_temperature: number
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          uid: string
          nickname: string
          manner_temperature?: number
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          nickname?: string
          manner_temperature?: number
          onboarding_completed?: boolean
          updated_at?: string
        }
      }

      // ── 국가 ────────────────────────────────────────────────────────────────
      countries: {
        Row: {
          country_id: number
          country_code: string
          name_ko: string
          name_en: string
          region_group: string
        }
        Insert: {
          country_id?: number
          country_code: string
          name_ko: string
          name_en: string
          region_group: string
        }
        Update: {
          country_code?: string
          name_ko?: string
          name_en?: string
          region_group?: string
        }
      }

      // ── 교환학생 프로필 ──────────────────────────────────────────────────────
      exchange_students: {
        Row: {
          uid: string
          country_id: number | null
          region_group: string | null
          housing_type: HousingTypeEnum | null
          semester: string | null
          language_pref: LanguagePrefEnum
          role: ExchangeRoleEnum | null
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          uid: string
          country_id?: number | null
          region_group?: string | null
          housing_type?: HousingTypeEnum | null
          semester?: string | null
          language_pref?: LanguagePrefEnum
          role?: ExchangeRoleEnum | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          country_id?: number | null
          region_group?: string | null
          housing_type?: HousingTypeEnum | null
          semester?: string | null
          language_pref?: LanguagePrefEnum
          role?: ExchangeRoleEnum | null
          onboarding_completed?: boolean
          updated_at?: string
        }
      }

      // ── 카테고리 ─────────────────────────────────────────────────────────────
      categories: {
        Row: {
          category_id: number
          name: string
          parent_id: number | null
        }
        Insert: {
          category_id?: number
          name: string
          parent_id?: number | null
        }
        Update: {
          name?: string
          parent_id?: number | null
        }
      }

      // ── 패키지 템플릿 ────────────────────────────────────────────────────────
      essential_packages: {
        Row: {
          package_id: number
          template_type: TemplateTypeEnum
          name: { ko: string; en: string }
          region_group: string | null
          housing_type: HousingTypeEnum | null
          created_at: string
        }
        Insert: {
          package_id?: number
          template_type: TemplateTypeEnum
          name: { ko: string; en: string }
          region_group?: string | null
          housing_type?: HousingTypeEnum | null
          created_at?: string
        }
        Update: {
          template_type?: TemplateTypeEnum
          name?: { ko: string; en: string }
          region_group?: string | null
          housing_type?: HousingTypeEnum | null
        }
      }

      // ── 패키지 구성 물품 ──────────────────────────────────────────────────────
      package_items: {
        Row: {
          package_item_id: number
          package_id: number
          category_id: number
          is_required: boolean
          priority_order: number
          requires_hygiene_cert: boolean
        }
        Insert: {
          package_item_id?: number
          package_id: number
          category_id: number
          is_required?: boolean
          priority_order?: number
          requires_hygiene_cert?: boolean
        }
        Update: {
          is_required?: boolean
          priority_order?: number
          requires_hygiene_cert?: boolean
        }
      }

      // ── 세탁 인증 ────────────────────────────────────────────────────────────
      hygiene_certifications: {
        Row: {
          cert_id: number
          seller_uid: string
          category_id: number
          image_url: string
          status: CertStatusEnum
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          cert_id?: number
          seller_uid: string
          category_id: number
          image_url: string
          status?: CertStatusEnum
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          image_url?: string
          status?: CertStatusEnum
          reviewed_at?: string | null
          updated_at?: string
        }
      }

      // ── 패키지 매칭 ──────────────────────────────────────────────────────────
      package_matches: {
        Row: {
          match_id: number
          package_id: number
          buyer_uid: string
          seller_uid: string
          status: MatchStatusEnum
          semester: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          match_id?: number
          package_id: number
          buyer_uid: string
          seller_uid: string
          status?: MatchStatusEnum
          semester?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: MatchStatusEnum
          semester?: string | null
          updated_at?: string
        }
      }

      // ── 패키지 매물 ──────────────────────────────────────────────────────────
      package_listings: {
        Row: {
          listing_id: number
          match_id: number
          seller_uid: string
          category_id: number
          status: ListingStatusEnum
          semester: string
          cert_id: number | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          listing_id?: number
          match_id: number
          seller_uid: string
          category_id: number
          status?: ListingStatusEnum
          semester: string
          cert_id?: number | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: ListingStatusEnum
          cert_id?: number | null
          image_url?: string | null
          updated_at?: string
        }
      }

      // ── 알림 신청 ────────────────────────────────────────────────────────────
      exchange_wishlists: {
        Row: {
          exchange_wishlist_id: number
          uid: string
          category_id: number
          region_group: string
          semester: string
          is_notified: boolean
          notified_at: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          exchange_wishlist_id?: number
          uid: string
          category_id: number
          region_group: string
          semester: string
          is_notified?: boolean
          notified_at?: string | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          is_notified?: boolean
          notified_at?: string | null
          deleted_at?: string | null
        }
      }

      // ── 채팅방 ───────────────────────────────────────────────────────────────
      chat_rooms: {
        Row: {
          room_id: number
          product_id: string | null
          package_match_id: number | null
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          room_id?: number
          product_id?: string | null
          package_match_id?: number | null
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          deleted_at?: string | null
        }
      }

      // ── 채팅 참여자 ──────────────────────────────────────────────────────────
      chat_participants: {
        Row: {
          id: number
          room_id: number
          uid: string
          last_read_at: string | null
          created_at: string
        }
        Insert: {
          id?: number
          room_id: number
          uid: string
          last_read_at?: string | null
          created_at?: string
        }
        Update: {
          last_read_at?: string | null
        }
      }

      // ── 채팅 메시지 ──────────────────────────────────────────────────────────
      chat_messages: {
        Row: {
          id: number
          room_id: number
          sender_uid: string
          data: { type: string; content: string }
          original_text: string
          translated_text: string | null
          source_lang: LanguagePrefEnum
          target_lang: LanguagePrefEnum
          created_at: string
        }
        Insert: {
          id?: number
          room_id: number
          sender_uid: string
          data: { type: string; content: string }
          original_text: string
          translated_text?: string | null
          source_lang: LanguagePrefEnum
          target_lang: LanguagePrefEnum
          created_at?: string
        }
        Update: {
          translated_text?: string | null
        }
      }

      // ── 일반 상품 (보완 시스템용, 읽기 전용) ──────────────────────────────────
      products: {
        Row: {
          pid: string
          seller_uid: string
          category_id: number
          title: string
          price: number
          condition: string
          status: ListingStatusEnum
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          pid?: string
          seller_uid: string
          category_id: number
          title: string
          price: number
          condition: string
          status?: ListingStatusEnum
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          title?: string
          price?: number
          condition?: string
          status?: ListingStatusEnum
          deleted_at?: string | null
        }
      }

      // ── 상품 이미지 (보완 시스템용, 읽기 전용) ───────────────────────────────
      product_images: {
        Row: {
          id: number
          pid: string
          image_url: string
          display_order: number
        }
        Insert: {
          id?: number
          pid: string
          image_url: string
          display_order?: number
        }
        Update: {
          image_url?: string
          display_order?: number
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      housing_type: HousingTypeEnum
      exchange_role: ExchangeRoleEnum
      language_pref: LanguagePrefEnum
      match_status: MatchStatusEnum
      cert_status: CertStatusEnum
      listing_status: ListingStatusEnum
      template_type: TemplateTypeEnum
    }
  }
}
