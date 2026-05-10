import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type Database } from '@/types/supabase'

/**
 * 서버 컴포넌트 / Route Handler / Server Action 용 Supabase 클라이언트
 *
 * - Next.js 15에서 cookies()가 async로 변경됨 → await 필수
 * - 서버 컴포넌트에서 쿠키를 읽기만 함 (Server Component는 set 불가)
 * - setAll에서 쿠키 set 시도 시 에러를 무시 — middleware.ts가 세션 갱신 담당
 *
 * 사용 예시 (Server Component):
 *   const supabase = await createServerSupabaseClient()
 *   const { data } = await supabase.from('exchange_students').select('*')
 */
export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서 set 호출 시 무시
            // 세션 갱신은 middleware.ts에서 처리
          }
        },
      },
    }
  )
}
