import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 이메일 인증 링크 클릭 시 Supabase가 이 경로로 리다이렉트함
// Supabase Dashboard > Authentication > URL Configuration > Redirect URLs 에
// http://localhost:3000/auth/callback 추가 필요
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
