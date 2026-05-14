import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

/**
 * POST /api/chat/create
 * 상품 채팅방 생성 (또는 기존 방 반환)
 * Body: { pid: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
    }

    const body = await request.json() as { pid: string }
    const { pid } = body
    if (!pid) {
      return NextResponse.json({ error: '상품 ID가 없어요' }, { status: 400 })
    }

    // 판매자 조회
    const { data: product } = await supabase
      .from('products')
      .select('seller_uid')
      .eq('pid', pid)
      .maybeSingle()

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없어요' }, { status: 404 })
    }
    if (product.seller_uid === user.id) {
      return NextResponse.json({ error: '본인 상품에는 채팅할 수 없어요' }, { status: 400 })
    }

    // service role로 RLS 없이 기존 채팅방 조회
    const admin = createServiceRoleClient()
    if (!admin) return NextResponse.json({ error: 'DB 연결 실패' }, { status: 503 })

    const { data: existingParticipation } = await admin
      .from('chat_participants')
      .select('room_id')
      .eq('uid', user.id)

    if (existingParticipation && existingParticipation.length > 0) {
      const myRoomIds = existingParticipation.map((p) => p.room_id)
      const { data: existingRoom } = await admin
        .from('chat_rooms')
        .select('room_id')
        .eq('product_id', pid)
        .in('room_id', myRoomIds)
        .limit(1)
        .maybeSingle()

      if (existingRoom) {
        return NextResponse.json({ room_id: existingRoom.room_id })
      }
    }

    const { data: room, error: roomError } = await admin
      .from('chat_rooms')
      .insert({ product_id: pid })
      .select('room_id')
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: '채팅방 생성에 실패했어요' }, { status: 500 })
    }

    const { error: partError } = await admin
      .from('chat_participants')
      .insert([
        { room_id: room.room_id, uid: user.id },
        { room_id: room.room_id, uid: product.seller_uid },
      ])

    if (partError) {
      return NextResponse.json({ error: '참여자 등록에 실패했어요' }, { status: 500 })
    }

    // 신규 방 생성 시 자동 첫 메시지 전송
    await admin
      .from('chat_messages')
      .insert({
        room_id: room.room_id,
        sender_uid: user.id,
        data: { type: 'text', content: '안녕하세요, 구매 희망합니다!' },
        original_text: '안녕하세요, 구매 희망합니다!',
      })

    return NextResponse.json({ room_id: room.room_id })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했어요' }, { status: 500 })
  }
}
