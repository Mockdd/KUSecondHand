import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBio, validateNickname } from '@/lib/auth/validate'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .from('users')
    .select('*')
    .eq('uid', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!row) {
    return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 })
  }

  let region_name: string | null = null
  if (row.preferred_region_id != null) {
    const { data: reg } = await supabase
      .from('regions')
      .select('name')
      .eq('region_id', row.preferred_region_id)
      .maybeSingle()
    region_name = reg?.name ?? null
  }

  let major_name: string | null = null
  if (row.major_id != null) {
    const { data: maj } = await supabase
      .from('majors')
      .select('name')
      .eq('major_id', row.major_id)
      .maybeSingle()
    major_name = maj?.name ?? null
  }

  const { password_hash: _p, password: _p2, ...safe } = row as Record<string, unknown>

  return NextResponse.json({
    profile: {
      ...safe,
      email: user.email ?? row.email,
      region_name,
      major_name,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const nickname = body.nickname as string | undefined
  const bio = body.bio as string | null | undefined
  const preferred_region_id = body.preferred_region_id as number | null | undefined
  const major_id = body.major_id as number | null | undefined
  const profile_image_url = body.profile_image_url as string | null | undefined

  if (nickname !== undefined) {
    const err = validateNickname(nickname)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }

  if (bio !== undefined && bio !== null) {
    const err = validateBio(bio)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (nickname !== undefined) patch.nickname = String(nickname).trim()
  if (bio !== undefined) patch.bio = bio === '' || bio === null ? null : String(bio).trim()
  if (preferred_region_id !== undefined) {
    patch.preferred_region_id =
      preferred_region_id === null || preferred_region_id === ('' as unknown)
        ? null
        : Number(preferred_region_id)
  }
  if (major_id !== undefined) {
    patch.major_id =
      major_id === null || major_id === ('' as unknown) ? null : Number(major_id)
  }
  if (profile_image_url !== undefined) {
    patch.profile_image_url = profile_image_url || null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('users')
    .update(patch)
    .eq('uid', user.id)
    .is('deleted_at', null)
    .select('uid, nickname, bio, profile_image_url, preferred_region_id, major_id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 사용 중인 닉네임입니다.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, profile: updated })
}
