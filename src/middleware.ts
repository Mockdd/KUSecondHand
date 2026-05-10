import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // 개발 중 인증 체크 비활성화 — 모든 페이지 자유 접근 가능
  // 실제 테스트 시 아래 주석 해제:
  // return updateSession(request)
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 아래 경로를 제외한 모든 요청에 미들웨어 적용:
     *   - _next/static (정적 파일)
     *   - _next/image (이미지 최적화)
     *   - favicon.ico, sitemap.xml, robots.txt
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
