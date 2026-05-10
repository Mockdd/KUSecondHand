import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { recomputeUserTrustMetrics } from '@/lib/trust/recompute'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: { transaction_id?: number; rating?: number; content?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const transactionId = body.transaction_id
  const rating = body.rating
  const content = body.content ?? null

  if (transactionId == null || typeof transactionId !== 'number' || !Number.isFinite(transactionId)) {
    return NextResponse.json({ error: 'transaction_id 가 필요합니다.' }, { status: 400 })
  }
  if (
    rating == null ||
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return NextResponse.json({ error: 'rating 은 1~5 정수여야 합니다.' }, { status: 400 })
  }

  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .select('transaction_id, buyer_uid, seller_uid, status')
    .eq('transaction_id', transactionId)
    .maybeSingle()

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })
  if (!tx) return NextResponse.json({ error: '거래를 찾을 수 없습니다.' }, { status: 404 })

  const buyer = tx.buyer_uid as string
  const seller = tx.seller_uid as string

  if (user.id !== buyer && user.id !== seller) {
    return NextResponse.json({ error: '이 거래의 참여자만 후기를 작성할 수 있습니다.' }, { status: 403 })
  }

  if (tx.status !== 'completed') {
    return NextResponse.json({ error: '완료된 거래에만 후기를 작성할 수 있습니다.' }, { status: 400 })
  }

  const reviewee_uid = user.id === buyer ? seller : buyer

  const { data: inserted, error: insErr } = await supabase
    .from('reviews')
    .insert({
      transaction_id: transactionId,
      reviewer_uid: user.id,
      reviewee_uid,
      rating,
      content,
    })
    .select('review_id')
    .maybeSingle()

  if (insErr) {
    if (insErr.code === '23505') {
      return NextResponse.json({ error: '이미 이 거래에 후기를 작성했습니다.' }, { status: 409 })
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: '서버 설정 오류(SUPABASE_SERVICE_ROLE_KEY)', review_id: inserted?.review_id },
      { status: 503 },
    )
  }

  try {
    await Promise.all([
      recomputeUserTrustMetrics(admin, buyer),
      recomputeUserTrustMetrics(admin, seller),
    ])
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : '신뢰 지표 갱신 실패',
        review_id: inserted?.review_id,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ review_id: inserted?.review_id })
}
