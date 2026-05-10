import { createBrowserClient } from '@supabase/ssr'
import { type Database } from '@/types/supabase'

/**
 * 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트
 *
 * - 클라이언트 컴포넌트에서 호출할 때마다 새 인스턴스를 반환
 * - RLS는 Supabase Auth 세션(anon key 기반)으로 자동 적용
 *
 * 사용 예시:
 *   const supabase = createClient()
 *   const { data } = await supabase.from('exchange_students').select('*')
 */
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
