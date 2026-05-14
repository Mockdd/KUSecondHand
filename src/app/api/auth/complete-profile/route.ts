import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import {
  validateNickname,
  validatePassword,
  validateStudentId,
} from '@/lib/auth/validate'
import { isAllowedSchoolEmail } from '@/constants/schoolDomains'

export async function POST(request: NextRequest) {
  let body: { nickname?: string; student_id?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { nickname, student_id, password } = body

  if (!password?.length) {
    return NextResponse.json({ error: '비밀번호를 입력하세요.' }, { status: 400 })
  }
  const errPw = validatePassword(password)
  if (errPw) return NextResponse.json({ error: errPw }, { status: 400 })

  if (!nickname?.trim()) {
    return NextResponse.json({ error: '닉네임을 입력하세요.' }, { status: 400 })
  }
  const errNn = validateNickname(nickname)
  if (errNn) return NextResponse.json({ error: errNn }, { status: 400 })

  if (!student_id?.trim()) {
    return NextResponse.json({ error: '학번을 입력하세요.' }, { status: 400 })
  }
  const errSid = validateStudentId(student_id)
  if (errSid) return NextResponse.json({ error: errSid }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.email || !user.id) {
    return NextResponse.json({ error: '로그인 세션이 없습니다. 인증을 다시 진행해 주세요.' }, { status: 401 })
  }

  const email = user.email
  if (!isAllowedSchoolEmail(email)) {
    return NextResponse.json(
      { error: '고려대학교 메일(@korea.ac.kr)만 가입할 수 있습니다.' },
      { status: 403 },
    )
  }

  // 회원가입 완료는 "본인 프로필 삽입" RLS 정책으로 충분합니다.
  // service role 키가 잘못 설정되면 Invalid API key로 가입이 막히므로,
  // 이 경로에서는 세션 기반 클라이언트만 사용합니다.
  const db = supabase
  const password_hash = bcrypt.hashSync(password, 12)

  const { data: existing } = await db.from('users').select('uid').eq('uid', user.id).maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, message: '이미 가입이 완료된 계정입니다.' })
  }

  const row = {
    uid: user.id,
    email,
    password_hash,
    nickname: nickname!.trim(),
    student_id: student_id!.trim(),
    school_domain: 'korea.ac.kr',
    profile_image_url: null as string | null,
    bio: null as string | null,
    preferred_region_id: null as number | null,
    deleted_at: null as string | null,
  }

  const { error: insertError } = await db.from('users').insert(row)

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일 또는 닉네임입니다.' },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: insertError.message, details: insertError.details },
      { status: 500 },
    )
  }

  // admin 클라이언트로 비밀번호 설정 (세션 의존성 없이 uid 기준으로 확실하게 처리)
  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  const { error: authPwError } = await admin.auth.admin.updateUserById(user.id, { password })
  if (authPwError) {
    return NextResponse.json(
      { error: `프로필은 저장됐으나 비밀번호 설정에 실패했습니다: ${authPwError.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
