/**
 * 기존 매물 + 패키지 embedding 일괄 생성 스크립트
 *
 * 실행 방법:
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * 환경변수 (.env.local 자동 로드):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← RLS 우회 필요
 *   OPENAI_API_KEY
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return res.data[0].embedding
}

// 요청 속도 제한 방어 (OpenAI: 3000 RPM)
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. 매물 backfill
// ──────────────────────────────────────────────────────────────────────────────

async function backfillProducts() {
  console.log('\n=== 매물 embedding 생성 시작 ===')

  // 전체 매물 조회
  const { data: products, error } = await supabase
    .from('products')
    .select('pid, title, description')
    .is('deleted_at', null)

  // 이미 embedding 있는 pid 조회
  const { data: existing } = await supabase
    .from('product_embeddings')
    .select('pid')

  const existingPids = new Set((existing ?? []).map((r) => r.pid))

  if (error) {
    console.error('매물 조회 실패:', error.message)
    return
  }

  const targets = (products ?? []).filter((p) => !existingPids.has(p.pid))
  console.log(`전체 매물: ${products?.length ?? 0}개 / embedding 미생성: ${targets.length}개`)

  let success = 0
  let fail = 0

  for (const product of targets) {
    try {
      const text = [product.title, product.description].filter(Boolean).join(' ')
      const embedding = await embed(text)

      const { error: upsertErr } = await supabase
        .from('product_embeddings')
        .upsert({ pid: product.pid, embedding: JSON.stringify(embedding) })

      if (upsertErr) throw upsertErr

      success++
      process.stdout.write(`\r완료: ${success} / ${targets.length}`)
      await sleep(50)
    } catch (err) {
      fail++
      console.error(`\n[실패] pid=${product.pid}:`, err)
    }
  }

  console.log(`\n매물 완료 — 성공: ${success}, 실패: ${fail}`)
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. 패키지 backfill
// ──────────────────────────────────────────────────────────────────────────────

async function backfillPackages() {
  console.log('\n=== 패키지 embedding 생성 시작 ===')

  const { data: packages, error } = await supabase
    .from('essential_packages')
    .select('package_id, name_ko, name_en')

  if (error) {
    console.error('패키지 조회 실패:', error.message)
    return
  }

  const { data: existingPkgs } = await supabase
    .from('package_embeddings')
    .select('package_id')

  const existingPkgIds = new Set((existingPkgs ?? []).map((r) => r.package_id))
  const pkgTargets = (packages ?? []).filter((p) => !existingPkgIds.has(p.package_id))

  console.log(`전체 패키지: ${packages?.length ?? 0}개 / embedding 미생성: ${pkgTargets.length}개`)

  let success = 0
  let fail = 0

  for (const pkg of packages ?? []) {
    try {
      const text = `${pkg.name_ko} ${pkg.name_en}`
      const embedding = await embed(text)

      const { error: upsertErr } = await supabase
        .from('package_embeddings')
        .upsert({ package_id: pkg.package_id, embedding: JSON.stringify(embedding) })

      if (upsertErr) throw upsertErr

      success++
      process.stdout.write(`\r완료: ${success} / ${packages?.length ?? 0}`)
      await sleep(50)
    } catch (err) {
      fail++
      console.error(`\n[실패] package_id=${pkg.package_id}:`, err)
    }
  }

  console.log(`\n패키지 완료 — 성공: ${success}, 실패: ${fail}`)
}

// ──────────────────────────────────────────────────────────────────────────────
// 실행
// ──────────────────────────────────────────────────────────────────────────────

;(async () => {
  await backfillProducts()
  await backfillPackages()
  console.log('\n=== 전체 완료 ===')
})()
