'use client'

import { createBrowserClient } from '@supabase/ssr'

/** /auth/callback 전용 — 싱글톤이 아니어야 URL 안의 PKCE 코드·implicit hash 가 초기 로드 때 파싱됨 */
export function createAuthCallbackSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false },
  )
}
