import { createClient } from '@supabase/supabase-js'

/**
 * 서버에서 OTP 메일 발송만 할 때 사용.
 * PKCE(flowType pkce + code_challenge 없이는 불가능) 대신 implicit 이메일 플로우로 보냄 —
 * 매직링크 클릭 시 fragment 기반이거나, 메일 템플릿에 표시되는 {{ .Token }} 으로 verifyOtp.
 */
export function createOtpEmailClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anon?.trim()) {
    throw new Error('Supabase URL/anon key가 설정되지 않았습니다.')
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
  })
}
