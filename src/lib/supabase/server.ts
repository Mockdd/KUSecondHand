// TODO: database.types.ts 생성 후 Database 타입 제네릭 추가
//   import type { Database } from './database.types'
//   createServerClient<Database>(...) 로 변경

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]
      .filter(Boolean)
      .join(', ')
    throw new Error(
      `[supabase/server] 환경변수 누락: ${missing}. .env.local 을 확인하세요.`,
    )
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      // @supabase/ssr 0.6.1 호환성 — 0.10+ 부터는 타입 자동 추론됨
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Server Component 컨텍스트에서는 cookie write 불가.
          // middleware 에서 세션 갱신을 처리하면 무시해도 안전.
        }
      },
    },
  })
}
