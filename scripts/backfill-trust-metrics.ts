/**
 * 과거 거래·리뷰 기준으로 모든 활성 사용자의
 * manner_temperature, successful_trade_count 를 재계산합니다.
 *
 * 필요 환경 변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 실행: npx tsx scripts/backfill-trust-metrics.ts
 * (로컬에서는 .env.local 이 로드되지 않으므로 같은 셸에서 export 하거나 `node --env-file=.env.local` 과 함께 실행)
 */
import { createClient } from '@supabase/supabase-js'

import { recomputeAllUsersTrustMetrics } from '../src/lib/trust/recompute'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 와 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

recomputeAllUsersTrustMetrics(admin)
  .then((r) => {
    console.log(`갱신 완료: ${r.updated}명`)
    if (r.errors.length) {
      console.error('오류:', r.errors.join('\n'))
      process.exit(1)
    }
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
