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

    // 기존 채팅방 조회
    const { data: existing } = await supabase
      .from('chat_rooms')
      .select('room_id, chat_participants!inner(uid)')
      .eq('product_id', pid)
      .eq('chat_participants.uid', user.id)

    if (existing && existing.length > 0) {
      return NextResponse.json({ room_id: existing[0].room_id })
    }

    // service role로 채팅방 + 참여자 생성 (RLS 우회)
    const admin = createServiceRoleClient()
    if (!admin) return NextResponse.json({ error: 'DB 연결 실패' }, { status: 503 })

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

    return NextResponse.json({ room_id: room.room_id })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했어요' }, { status: 500 })
  }
}
