import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 로그인 성공 후 호출: 활동 시각 갱신 + 휴면 해제 */
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
    if (error.message?.includes('column') || error.code === '42703') {
      return NextResponse.json({
        ok: true,
        skipped: true,
        hint: 'users.last_activity_at 컬럼이 없습니다. db/migrations/002_account_activity_dormant.sql 적용 필요.',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
