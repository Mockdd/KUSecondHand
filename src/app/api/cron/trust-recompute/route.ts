import { NextRequest, NextResponse } from 'next/server'

import { createServiceRoleClient } from '@/lib/supabase/admin'
import { recomputeAllUsersTrustMetrics } from '@/lib/trust/recompute'

/**
 * 과거 거래·리뷰 기준으로 manner_temperature, successful_trade_count 일괄 재계산.
 * 헤더: Authorization: Bearer <CRON_SECRET> 또는 x-cron-secret
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  const headerSecret = request.headers.get('x-cron-secret')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret && headerSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 필요' }, { status: 503 })
  }

  try {
    const result = await recomputeAllUsersTrustMetrics(admin)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '재계산 실패' },
      { status: 500 },
    )
  }
}
