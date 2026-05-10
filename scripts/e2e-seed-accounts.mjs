/**
 * E2E용 테스트 계정 3개 생성 → 로그인 검증 → 1명 탈퇴 → 1명 휴면 처리
 * 실행: node scripts/e2e-seed-accounts.mjs
 */
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = join(root, name)
    if (!existsSync(p)) continue
    const text = readFileSync(p, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i === -1) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      if (process.env[k] === undefined) process.env[k] = v
    }
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey || !anonKey) {
  console.error('필수 환경변수 누락.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const seedTag = `e2e${Date.now().toString(36)}`
const password = 'E2eTest#8ok'

const accounts = [
  { key: 'a', role: '탈퇴 테스트' },
  { key: 'b', role: '휴면 테스트' },
  { key: 'c', role: '활성 유지' },
].map((x) => ({
  ...x,
  email: `${seedTag}_${x.key}@korea.ac.kr`,
}))

async function findAuthUserIdByEmail(email) {
  let page = 1
  for (let n = 0; n < 30; n++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => x.email === email)
    if (u) return u.id
    if (!data.users?.length || data.users.length < 200) break
    page += 1
  }
  return null
}

async function removeUserCompletely(email) {
  const uid = await findAuthUserIdByEmail(email)
  if (!uid) return
  await admin.from('users').delete().eq('uid', uid)
  await admin.auth.admin.deleteUser(uid)
}

function nickFor(i) {
  const n = `${seedTag}_${i}`
  return n.length <= 50 ? n : n.slice(0, 50)
}

async function detectUserColumns() {
  const { data, error } = await admin.from('users').select('*').limit(1).maybeSingle()
  if (error && error.code !== 'PGRST116') {
    console.warn('users 샘플 조회 경고:', error.message)
  }
  if (data && typeof data === 'object') return new Set(Object.keys(data))
  return null
}

function buildUsersRow(uid, email, nickname, columns) {
  const hash = bcrypt.hashSync(password, 12)
  const base = {
    uid,
    email,
    nickname,
    student_id: String(20250000 + Math.floor(Math.random() * 90000)),
    school_domain: 'korea.ac.kr',
  }

  if (!columns) {
    return {
      ...base,
      password_hash: hash,
      profile_image_url: null,
      bio: null,
      preferred_region_id: null,
      deleted_at: null,
    }
  }

  const row = {}
  if (columns.has('uid')) row.uid = uid
  if (columns.has('email')) row.email = email
  if (columns.has('nickname')) row.nickname = nickname
  if (columns.has('student_id')) row.student_id = base.student_id
  if (columns.has('school_domain')) row.school_domain = 'korea.ac.kr'
  if (columns.has('password_hash')) row.password_hash = hash
  if (columns.has('password')) row.password = hash
  if (columns.has('profile_image_url')) row.profile_image_url = null
  if (columns.has('bio')) row.bio = null
  if (columns.has('preferred_region_id')) row.preferred_region_id = null
  if (columns.has('deleted_at')) row.deleted_at = null
  if (columns.has('joined_at')) row.joined_at = new Date().toISOString()
  if (columns.has('manner_temperature')) row.manner_temperature = 36.5
  if (columns.has('trade_count')) row.trade_count = 0
  if (columns.has('is_suspended')) row.is_suspended = false
  if (columns.has('warning_count')) row.warning_count = 0
  if (columns.has('grade')) row.grade = null
  if (columns.has('major_id')) row.major_id = null
  if (columns.has('onboarding_completed')) row.onboarding_completed = false
  return row
}

async function createAccount(email, nickname, columns) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  const uid = data.user.id
  await admin.from('users').delete().eq('uid', uid)
  const row = buildUsersRow(uid, email, nickname, columns)
  const { error: insErr } = await admin.from('users').insert(row)
  if (insErr) throw insErr
  return uid
}

async function verifyPasswordLogin(email) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  await client.auth.signOut()
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

async function withdrawLikeProduction(email) {
  const uid = await findAuthUserIdByEmail(email)
  if (!uid) throw new Error(`auth user not found: ${email}`)
  const { error: uerr } = await admin
    .from('users')
    .update({ deleted_at: new Date().toISOString() })
    .eq('uid', uid)
  if (uerr) throw uerr
  const { error: derr } = await admin.auth.admin.deleteUser(uid)
  if (derr) throw derr
}

async function markDormant(email, columns) {
  const uid = await findAuthUserIdByEmail(email)
  if (!uid) throw new Error(`auth user not found: ${email}`)
  const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
  const patch = {}
  if (!columns || columns.has('last_activity_at')) patch.last_activity_at = old
  if (!columns || columns.has('dormant_at')) patch.dormant_at = new Date().toISOString()

  if (Object.keys(patch).length === 0) {
    throw new Error('users 테이블에 last_activity_at / dormant_at 컬럼이 없습니다.')
  }

  const { error } = await admin.from('users').update(patch).eq('uid', uid)
  if (error) throw error
}

async function main() {
  console.log('=== E2E 시드 (Admin으로 auth + users 생성, OTP 메일 아님) ===\n')

  const columns = await detectUserColumns()
  if (columns) {
    console.log('감지된 users 컬럼 샘플:', [...columns].sort().join(', '))
  } else {
    console.log('users 테이블에 기존 행 없음 → 명세 기준 기본 insert 시도')
  }

  for (let i = 0; i < accounts.length; i++) {
    const { email } = accounts[i]
    await removeUserCompletely(email)
    const nickname = nickFor(i)
    await createAccount(email, nickname, columns)
    console.log(`[${i + 1}/3] 생성 완료 ${email}`)
  }

  console.log('\n=== 비밀번호 로그인 검증 ===\n')
  for (const a of accounts) {
    const r = await verifyPasswordLogin(a.email)
    console.log(`${r.ok ? '✓' : '✗'} ${a.email} → ${r.ok ? 'OK' : r.message}`)
  }

  console.log('\n=== 탈퇴 (A) ===\n')
  await withdrawLikeProduction(accounts[0].email)
  const afterWithdraw = await verifyPasswordLogin(accounts[0].email)
  console.log(
    afterWithdraw.ok
      ? '✗ 탈퇴 후 로그인 성공(비정상)'
      : `✓ 탈퇴 후 로그인 불가: ${afterWithdraw.message}`,
  )

  console.log('\n=== 휴면 플래그 (B) ===\n')
  try {
    await markDormant(accounts[1].email, columns)
    console.log('✓ dormant 처리 완료')
    const bLogin = await verifyPasswordLogin(accounts[1].email)
    console.log(
      bLogin.ok
        ? '  Auth 로그인은 가능 → 앱에서 /api/account/status 로 휴면 분기 확인'
        : `  로그인 실패: ${bLogin.message}`,
    )
  } catch (e) {
    console.error('✗', e.message || e)
  }

  console.log('\n=== 활성 (C) 로그인 ===\n')
  const c = await verifyPasswordLogin(accounts[2].email)
  console.log(c.ok ? '✓ OK' : `✗ ${c.message}`)

  console.log('\n--- 요약 ---')
  console.log('비밀번호:', password)
  accounts.forEach((a, i) => console.log(`${i + 1}. ${a.email} (${a.role})`))
  console.log(
    '\n※ 학교메일 OTP 회원가입(/register→메일→/verify)은 자동화 불가. 위 계정은 Admin으로만 생성됨.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
