import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: { code: 'NOT_AUTHENTICATED', message: '로그인이 필요해요' } },
        { status: 401 }
      )
    }

    // 2. 요청 파싱
    const body = (await request.json()) as { match_id: number }
    const { match_id } = body

    if (!match_id) {
      return NextResponse.json(
        { data: null, error: { code: 'INVALID_REQUEST', message: 'match_id가 없어요' } },
        { status: 400 }
      )
    }

    // 3. 매칭 조회 — 셀러 본인 확인 + 상태 확인
    const { data: match, error: matchError } = await supabase
      .from('package_matches')
      .select('match_id, package_id, seller_uid, buyer_uid, status')
      .eq('match_id', match_id)
      .single()

    if (matchError || !match) {
      return NextResponse.json(
        { data: null, error: { code: 'NOT_FOUND', message: '매칭을 찾을 수 없어요' } },
        { status: 404 }
      )
    }

    if (match.seller_uid !== user.id) {
      return NextResponse.json(
        { data: null, error: { code: 'FORBIDDEN', message: '셀러만 거래 완료 처리를 할 수 있어요' } },
        { status: 403 }
      )
    }

    if (match.status !== 'matched') {
      return NextResponse.json(
        { data: null, error: { code: 'INVALID_STATUS', message: `거래 완료는 채팅 진행 중(matched) 상태에서만 가능해요 (현재: ${match.status})` } },
        { status: 400 }
      )
    }

    // 4. 거래 완료 처리
    const { error: completeError } = await supabase
      .from('package_matches')
      .update({ status: 'completed' })
      .eq('match_id', match_id)

    if (completeError) {
      console.error('[matches/complete] 완료 처리 실패:', completeError)
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: '거래 완료 처리에 실패했어요' } },
        { status: 500 }
      )
    }

    // 5. 나머지 바이어 매칭 일괄 cancelled
    const { data: cancelled, error: cancelError } = await supabase
      .from('package_matches')
      .update({ status: 'cancelled' })
      .eq('seller_uid', match.seller_uid)
      .eq('package_id', match.package_id)
      .neq('match_id', match_id)
      .in('status', ['pending', 'matched'])
      .select('match_id')

    if (cancelError) {
      // 완료는 성공했으므로 에러 로그만 남기고 계속 진행
      console.error('[matches/complete] 나머지 매칭 취소 실패:', cancelError)
    }

    return NextResponse.json({
      data: {
        match_id,
        status: 'completed',
        cancelled_count: cancelled?.length ?? 0,
      },
      error: null,
    })
  } catch (err) {
    console.error('[matches/complete] 예상치 못한 오류:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했어요' } },
      { status: 500 }
    )
  }
}
