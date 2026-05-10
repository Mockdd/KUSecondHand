import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { validatePassword } from '@/lib/auth/validate'

/** 이메일 재설정 링크로 변경한 비밀번호를 users.password_hash 와 맞춤 */
export async function POST(request: NextRequest) {
  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const password = body.password
  if (!password?.length) {
    return NextResponse.json({ error: '비밀번호를 입력하세요.' }, { status: 400 })
  }
  const errPw = validatePassword(password)
  if (errPw) return NextResponse.json({ error: errPw }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const hash = bcrypt.hashSync(password, 12)
  const db = createServiceRoleClient() ?? supabase

  const { error } = await db.from('users').update({ password_hash: hash }).eq('uid', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
