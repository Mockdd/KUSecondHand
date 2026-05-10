import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/matches/auto
 *
 * 자동 매칭 API
 *
 * 역할:
 *   - 같은 region_group 내 셀러(Outgoing)와 바이어(Incoming)를 자동 매칭
 *   - exchange_wishlists ↔ package_listings 겹치는 category_id 기준으로 매칭
 *   - 이미 pending/matched 상태인 바이어-셀러-패키지 조합은 스킵
 *
 * 호출 방식:
 *   - 운영: 자산순환 파트 cron 스케줄러 (종강 D-14일)
 *   - 테스트: 직접 POST 호출
 *
 * Request Body (optional):
 *   { "semester": "2026-1" }  ← 생략 시 모든 학기 처리
 *
 * Response:
 *   { "data": { "matched": 3, "skipped": 1 }, "error": null }
 *
 * 인증:
 *   - Supabase Auth 세션 필요 (운영 시 service_role 키 사용 권장)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // ── 인증 확인 ──────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_AUTHENTICATED', message: '로그인이 필요해요' } },
      { status: 401 }
    )
  }

  // ── 요청 바디 파싱 ─────────────────────────────────────────────────────────
  let targetSemester: string | null = null
  try {
    const body = await request.json()
    targetSemester = body.semester ?? null
  } catch {
    // body 없어도 허용
  }

  // ── 1. 매칭 대상 셀러 조회 ─────────────────────────────────────────────────
  // Outgoing(셀러)이고 package_listings(status=selling)가 있는 사용자
  let sellerQuery = supabase
    .from('package_listings')
    .select('seller_uid, category_id, semester, match_id')
    .eq('status', 'selling')

  if (targetSemester) {
    sellerQuery = sellerQuery.eq('semester', targetSemester)
  }

  const { data: sellerListings, error: sellerError } = await sellerQuery

  if (sellerError) {
    console.error('[auto-match] 셀러 조회 실패:', sellerError)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '셀러 조회 중 오류가 발생했어요' } },
      { status: 500 }
    )
  }

  if (!sellerListings || sellerListings.length === 0) {
    return NextResponse.json({ data: { matched: 0, skipped: 0 }, error: null })
  }

  const sellerUids = [...new Set(sellerListings.map((l) => l.seller_uid))]

  // ── 2. 셀러의 exchange_students 정보 조회 (region_group, role 확인) ─────────
  const { data: sellerProfiles } = await supabase
    .from('exchange_students')
    .select('uid, region_group, role')
    .in('uid', sellerUids)
    .eq('role', 'outgoing')

  const sellerProfileMap = new Map(
    (sellerProfiles ?? []).map((p) => [p.uid, p])
  )

  // ── 3. 셀러의 package_id 조회 (match_id → package_id) ─────────────────────
  const matchIds = [...new Set(sellerListings.map((l) => l.match_id))]
  const { data: matchData } = await supabase
    .from('package_matches')
    .select('match_id, package_id')
    .in('match_id', matchIds)

  const matchPackageMap = new Map(
    (matchData ?? []).map((m) => [m.match_id, m.package_id])
  )

  // ── 4. 셀러별 메타 맵 구성 ────────────────────────────────────────────────
  type SellerMeta = {
    regionGroup: string
    semester: string
    packageId: number
    categoryIds: Set<number>
  }
  const sellerMap = new Map<string, SellerMeta>()

  for (const listing of sellerListings) {
    const profile = sellerProfileMap.get(listing.seller_uid)
    if (!profile?.region_group) continue

    const packageId = matchPackageMap.get(listing.match_id)
    if (!packageId) continue

    const existing = sellerMap.get(listing.seller_uid)
    if (existing) {
      existing.categoryIds.add(listing.category_id)
    } else {
      sellerMap.set(listing.seller_uid, {
        regionGroup: profile.region_group,
        semester: listing.semester,
        packageId,
        categoryIds: new Set([listing.category_id]),
      })
    }
  }

  if (sellerMap.size === 0) {
    return NextResponse.json({ data: { matched: 0, skipped: 0 }, error: null })
  }

  // ── 5. 알림 신청 바이어 조회 ────────────────────────────────────────────────
  let wishlistQuery = supabase
    .from('exchange_wishlists')
    .select('uid, category_id, region_group, semester')
    .is('deleted_at', null)
    .eq('is_notified', false)

  if (targetSemester) {
    wishlistQuery = wishlistQuery.eq('semester', targetSemester)
  }

  const { data: wishlists, error: wishlistError } = await wishlistQuery

  if (wishlistError) {
    console.error('[auto-match] 위시리스트 조회 실패:', wishlistError)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '위시리스트 조회 중 오류가 발생했어요' } },
      { status: 500 }
    )
  }

  if (!wishlists || wishlists.length === 0) {
    return NextResponse.json({ data: { matched: 0, skipped: 0 }, error: null })
  }

  // 바이어가 incoming role인지 확인
  const buyerUids = [...new Set(wishlists.map((w) => w.uid))]
  const { data: buyerProfiles } = await supabase
    .from('exchange_students')
    .select('uid, role')
    .in('uid', buyerUids)
    .eq('role', 'incoming')

  const incomingBuyers = new Set((buyerProfiles ?? []).map((p) => p.uid))

  // ── 6. 기존 매칭 조회 (중복 방지) ─────────────────────────────────────────
  const { data: existingMatches } = await supabase
    .from('package_matches')
    .select('buyer_uid, seller_uid, package_id')
    .in('seller_uid', sellerUids)
    .in('buyer_uid', buyerUids)
    .in('status', ['pending', 'matched'])

  const existingPairs = new Set(
    (existingMatches ?? []).map((m) => `${m.buyer_uid}__${m.seller_uid}__${m.package_id}`)
  )

  // ── 7. 매칭 후보 생성 ──────────────────────────────────────────────────────
  const newMatches: {
    package_id: number
    buyer_uid: string
    seller_uid: string
    status: 'pending'
    semester: string
  }[] = []

  let skipped = 0

  for (const wish of wishlists) {
    if (!incomingBuyers.has(wish.uid)) continue

    for (const [sellerUid, meta] of sellerMap) {
      if (meta.regionGroup !== wish.region_group) continue
      if (meta.semester !== wish.semester) continue
      if (!meta.categoryIds.has(wish.category_id)) continue

      const pairKey = `${wish.uid}__${sellerUid}__${meta.packageId}`
      if (existingPairs.has(pairKey)) {
        skipped++
        continue
      }

      // 이번 배치 내 중복 방지
      existingPairs.add(pairKey)

      newMatches.push({
        package_id: meta.packageId,
        buyer_uid: wish.uid,
        seller_uid: sellerUid,
        status: 'pending',
        semester: wish.semester,
      })
    }
  }

  if (newMatches.length === 0) {
    return NextResponse.json({ data: { matched: 0, skipped }, error: null })
  }

  // ── 8. package_matches INSERT ──────────────────────────────────────────────
  const { error: insertError } = await supabase
    .from('package_matches')
    .insert(newMatches)

  if (insertError) {
    console.error('[auto-match] 매칭 저장 실패:', insertError)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '매칭 저장 중 오류가 발생했어요' } },
      { status: 500 }
    )
  }

  // ── 9. 매칭된 바이어의 wishlist is_notified 업데이트 ─────────────────────
  const matchedBuyerUids = [...new Set(newMatches.map((m) => m.buyer_uid))]
  const notifyQuery = supabase
    .from('exchange_wishlists')
    .update({ is_notified: true, notified_at: new Date().toISOString() })
    .in('uid', matchedBuyerUids)
    .is('deleted_at', null)

  if (targetSemester) {
    await notifyQuery.eq('semester', targetSemester)
  } else {
    await notifyQuery
  }

  return NextResponse.json({
    data: { matched: newMatches.length, skipped },
    error: null,
  })
}
