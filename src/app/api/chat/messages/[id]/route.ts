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

    // 인증
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ data: null, error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    // admin으로 참여자 확인 (chat_participants 자기참조 RLS 우회)
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

    // admin으로 메시지 조회 (chat_messages SELECT 정책도 chat_participants 참조)
    const { data: messages, error: msgError } = await admin
      .from('chat_messages')
      .select(`
        id,
        sender_uid,
        original_text,
        created_at,
        users!sender_uid (nickname)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('[chat/messages] 메시지 조회 실패:', msgError)
      return NextResponse.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
    }

    // 읽음 처리 — 메시지 조회 시마다 last_read_at 갱신 (fire-and-forget)
    admin
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('uid', user.id)
      .then(() => {})

    const result = (messages ?? []).map((m) => ({
      id: m.id,
      sender_uid: m.sender_uid,
      sender_name:
        (Array.isArray(m.users)
          ? (m.users[0] as { nickname: string } | undefined)?.nickname
          : (m.users as { nickname: string } | null)?.nickname) ?? '알 수 없음',
      text: m.original_text ?? '',
      created_at: m.created_at,
    }))

    return NextResponse.json({ data: result, error: null })
  } catch (err) {
    console.error('[chat/messages] 예상치 못한 오류:', err)
    return NextResponse.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
