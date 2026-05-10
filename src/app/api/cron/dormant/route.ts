import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { inactiveCutoffIso } from '@/lib/account/dormant'

/**
 * 휴면 일괄 전환 (스케줄러 / 수동 호출)
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

  const cutoff = inactiveCutoffIso()

  const { data: rows, error } = await admin
    .from('users')
    .select('uid, last_activity_at, joined_at, dormant_at, deleted_at')
    .is('deleted_at', null)
    .is('dormant_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const stale = (rows ?? []).filter((r) => {
    const ref =
      r.last_activity_at ??
      (r as { joined_at?: string }).joined_at ??
      null
    if (!ref) return false
    return ref < cutoff
  })

  let marked = 0
  const now = new Date().toISOString()

  for (const r of stale) {
    const { error: uErr } = await admin
      .from('users')
      .update({ dormant_at: now })
      .eq('uid', r.uid)
    if (!uErr) marked += 1
  }

  return NextResponse.json({
    ok: true,
    cutoff,
    candidates: stale.length,
    marked,
  })
}
