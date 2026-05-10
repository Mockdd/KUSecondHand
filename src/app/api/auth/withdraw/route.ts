import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const db = createServiceRoleClient() ?? supabase

  const { data: profile, error: selErr } = await db
    .from('users')
    .select('password_hash')
    .eq('uid', user.id)
    .maybeSingle()

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }

  if (!profile?.password_hash) {
    return NextResponse.json({ error: '프로필 정보를 찾을 수 없습니다.' }, { status: 400 })
  }

  const valid = bcrypt.compareSync(password, profile.password_hash as string)
  if (!valid) {
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 })
  }

  const deletedAt = new Date().toISOString()

  const { error: updErr } = await db
    .from('users')
    .update({ deleted_at: deletedAt })
    .eq('uid', user.id)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  const admin = createServiceRoleClient()
  if (admin) {
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(user.id)
    if (delAuthErr) {
      return NextResponse.json(
        { error: `DB는 탈퇴 처리됐으나 인증 계정 삭제에 실패했습니다: ${delAuthErr.message}` },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true })
}
