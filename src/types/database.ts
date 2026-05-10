/**
 * DB Row 타입 (수동). 이후 `supabase gen types` 로 교체 권장.
 * @see db/tableSpec.md
 */
export interface User {
  uid: string
  email: string
  password_hash: string
  nickname: string
  student_id: string
  school_domain: string
  profile_image_url: string | null
  bio: string | null
  preferred_region_id: number | null
  major_id?: number | null
  grade?: string | null
  onboarding_completed?: boolean | null
  joined_at: string
  manner_temperature: number
  trade_count: number
  /** @see db/migrations/003_trust_successful_trade_count.sql — 마이그레이션 전 DB 에서는 없을 수 있음 */
  successful_trade_count?: number
  is_suspended: boolean
  warning_count: number
  deleted_at: string | null
  /** @see db/migrations/002_account_activity_dormant.sql */
  last_activity_at?: string | null
  dormant_at?: string | null
}
