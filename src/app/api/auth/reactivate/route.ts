import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 이메일 OTP 인증 후 세션이 있을 때 휴면 플래그 해제 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('users')
    .update({
      last_activity_at: now,
      dormant_at: null,
    })
    .eq('uid', user.id)
    .is('deleted_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
