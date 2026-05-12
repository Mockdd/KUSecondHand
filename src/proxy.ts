import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  const exact = [
    '/login',
    '/register',
    '/verify',
    '/auth/callback',
    '/forgot-password',
    '/reset-password',
    '/find-id',
    '/reactivate',
  ]
  if (exact.includes(pathname)) return true
  if (pathname.startsWith('/find-id/')) return true
  return false
}

/** Trailing slash → canonical path (예: /auth/callback/ → /auth/callback) */
function pathnameNoTrailingSlash(p: string) {
  if (p !== '/' && p.endsWith('/')) return p.slice(0, -1)
  return p
}

export async function proxy(request: NextRequest) {
  const pathname = pathnameNoTrailingSlash(request.nextUrl.pathname)

  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next({ request })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl?.trim() || !supabaseAnon?.trim()) {
    console.error('[proxy] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 비어 있습니다.')
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnon,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Next.js 15+ request.cookies 불변 · 응답 쿠키만 설정 (@supabase/ssr 패턴).
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let accountRow: { deleted_at: string | null; dormant_at: string | null } | null = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('deleted_at, dormant_at')
      .eq('uid', user.id)
      .maybeSingle()
    accountRow = data ?? null
  }

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const nextParam = pathname + (request.nextUrl.search || '')
    url.searchParams.set('next', nextParam)
    return NextResponse.redirect(url)
  }

  if (user && accountRow?.deleted_at && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('reason', 'withdrawn')
    return NextResponse.redirect(url)
  }

  if (
    user &&
    accountRow?.dormant_at &&
    pathname !== '/reactivate' &&
    !isPublicPath(pathname)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/reactivate'
    return NextResponse.redirect(url)
  }

  if (
    user &&
    ['/login', '/register'].includes(pathname) &&
    !accountRow?.deleted_at &&
    !accountRow?.dormant_at
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/products'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

/** Next 공식 예시와 유사: api · 정적 번들 등은 매칭에서 제외해 dev 안정화 */
export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next/static|_next/image|_next/webpack-hmr|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
