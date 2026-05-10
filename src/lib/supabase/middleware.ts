import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { type Database } from '@/types/supabase'

/**
 * Supabase 세션 갱신 + 라우트 보호 미들웨어
 *
 * 역할:
 *   1. 모든 요청에서 Supabase 세션 토큰을 갱신 (refresh token rotation)
 *   2. 보호 라우트 접근 시 미로그인 → /login 리다이렉트
 *   3. 교환학생 전용 라우트는 반드시 로그인 필요
 *      (온보딩 완료 여부는 각 페이지/훅에서 별도 체크)
 *
 * 주의:
 *   - createServerClient와 supabase.auth.getUser() 사이에 코드 삽입 금지
 *   - supabaseResponse를 반드시 반환해야 쿠키가 클라이언트에 전달됨
 *
 * 사용 방법 (src/middleware.ts):
 *   export async function middleware(request: NextRequest) {
 *     return updateSession(request)
 *   }
 */
export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ⚠️ 여기에 코드 추가 금지 — getUser() 전에는 아무것도 하지 않음
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 보호 라우트 정의 ──────────────────────────────────────────────────────
  const PROTECTED_PATHS = [
    '/packages',
    '/sell',
    '/chat',
    '/wishlist',
    '/mypage',
    '/onboarding',
  ]

  const pathname = request.nextUrl.pathname
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path))

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    // 로그인 후 원래 페이지로 돌아올 수 있도록 returnTo 파라미터 추가
    loginUrl.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ⚠️ supabaseResponse를 반드시 반환 — 다른 Response 객체를 반환하면 쿠키 유실
  return supabaseResponse
}
