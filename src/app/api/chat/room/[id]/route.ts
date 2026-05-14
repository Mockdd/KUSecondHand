import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const roomId = Number(id)
    if (!roomId) return NextResponse.json({ data: null, error: 'INVALID_ID' }, { status: 400 })

    // 인증: 서버 쿠키로 유저 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ data: null, error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    // RLS 우회(admin)로 참여자 확인 — chat_participants 자기참조 RLS 회피
    const admin = createServiceRoleClient()
    if (!admin) return NextResponse.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })

    const { data: participant } = await admin
      .from('chat_participants')
      .select('cp_id')
      .eq('room_id', roomId)
      .eq('uid', user.id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json({ data: null, error: 'FORBIDDEN' }, { status: 403 })
    }

    // admin으로 채팅방 기본 정보 조회
    const { data: room, error: roomError } = await admin
      .from('chat_rooms')
      .select('room_id, product_id, package_match_id')
      .eq('room_id', roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    // admin으로 참여자 목록 조회
    const { data: participants } = await admin
      .from('chat_participants')
      .select('uid')
      .eq('room_id', roomId)

    const counterpartUid = (participants ?? []).find((p) => p.uid !== user.id)?.uid ?? null

    // 상대방 닉네임
    let counterpart_name = '알 수 없음'
    if (counterpartUid) {
      const { data: u } = await admin
        .from('users')
        .select('nickname')
        .eq('uid', counterpartUid)
        .single()
      counterpart_name = u?.nickname ?? '알 수 없음'
    }

    // 상품 채팅방
    if (room.product_id) {
      const { data: product } = await admin
        .from('products')
        .select('title')
        .eq('pid', room.product_id)
        .single()

      return NextResponse.json({
        data: {
          type: 'product',
          room_id: room.room_id,
          product_id: room.product_id,
          product_title: product?.title ?? '상품',
          counterpart_name,
          sender_uid: user.id,
        },
        error: null,
      })
    }

    // 패키지 채팅방
    if (!room.package_match_id) {
      return NextResponse.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    const { data: match } = await admin
      .from('package_matches')
      .select('match_id, status, seller_uid, buyer_uid, package_id, semester')
      .eq('match_id', room.package_match_id)
      .single()

    if (!match) {
      return NextResponse.json({ data: null, error: 'NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        type: 'package',
        room_id: room.room_id,
        match_id: match.match_id,
        package_match: {
          status: match.status,
          seller_uid: match.seller_uid,
          buyer_uid: match.buyer_uid,
          package_id: match.package_id,
          semester: match.semester,
        },
        counterpart_name,
        sender_uid: user.id,
      },
      error: null,
    })
  } catch (err) {
    console.error('[chat/room] 예상치 못한 오류:', err)
    return NextResponse.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
