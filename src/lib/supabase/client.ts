// TODO: database.types.ts 생성 후 Database 타입 제네릭 추가
//   import type { Database } from './database.types'
//   createBrowserClient<Database>(...) 로 변경

import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (browserClient) return browserClient

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
      `[supabase/client] 환경변수 누락: ${missing}. .env.local 을 확인하세요.`,
    )
  }

  browserClient = createBrowserClient(url, anonKey)
  return browserClient
}
