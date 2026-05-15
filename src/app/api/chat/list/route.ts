import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'

interface ChatListItem {
  key: string
  room_id: number
  status: string
  subtitle: string
  counterpart_name: string
  last_message: string | null
  last_message_at: string | null
  unread_count: number
  package_session_id?: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ data: null, error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }

    const admin = createServiceRoleClient()
    if (!admin) return NextResponse.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })

    const results: ChatListItem[] = []

    // ── 1. 패키지 채팅방 ──────────────────────────────────────────────────
    const { data: pkgData } = await admin
      .from('package_matches')
      .select(`
        match_id, status, semester, buyer_uid, seller_uid, package_id,
        essential_packages (name_ko),
        buyer:users!buyer_uid (nickname),
        seller:users!seller_uid (nickname),
        chat_rooms (room_id, chat_messages (original_text, created_at, sender_uid))
      `)
      .or(`buyer_uid.eq.${user.id},seller_uid.eq.${user.id}`)
      .in('status', ['pending', 'matched'])
      .order('created_at', { ascending: false })

    // 내 참여 정보 (last_read_at) 조회
    const { data: myParticipations } = await admin
      .from('chat_participants')
      .select('room_id, last_read_at')
      .eq('uid', user.id)

    const lastReadMap = new Map<number, string | null>(
      (myParticipations ?? []).map((p) => [p.room_id, p.last_read_at])
    )

    for (const m of pkgData ?? []) {
      const rooms = Array.isArray(m.chat_rooms) ? m.chat_rooms : [m.chat_rooms]
      const room = rooms[0] as { room_id: number; chat_messages?: { original_text: string | null; created_at: string; sender_uid: string }[] } | null
      if (!room || m.buyer_uid === m.seller_uid) continue

      const isSeller = m.seller_uid === user.id
      const buyerNickname = Array.isArray(m.buyer)
        ? (m.buyer[0] as { nickname: string } | undefined)?.nickname
        : (m.buyer as { nickname: string } | null)?.nickname
      const sellerNickname = Array.isArray(m.seller)
        ? (m.seller[0] as { nickname: string } | undefined)?.nickname
        : (m.seller as { nickname: string } | null)?.nickname
      const packageRow = Array.isArray(m.essential_packages)
        ? (m.essential_packages[0] as { name_ko: string } | undefined)
        : (m.essential_packages as { name_ko: string } | null)

      const msgs = room.chat_messages ?? []
      const latest = msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

      const lastRead = lastReadMap.get(room.room_id) ?? null
      const unread_count = msgs.filter((msg) =>
        msg.sender_uid !== user.id &&
        (!lastRead || new Date(msg.created_at) > new Date(lastRead))
      ).length

      results.push({
        key: `pkg-${m.match_id}`,
        room_id: room.room_id,
        status: m.status,
        subtitle: packageRow?.name_ko ?? `패키지 #${m.package_id}`,
        counterpart_name: isSeller ? (buyerNickname ?? '알 수 없음') : (sellerNickname ?? '알 수 없음'),
        last_message: latest?.original_text ?? null,
        last_message_at: latest?.created_at ?? null,
        unread_count,
      })
    }

    // ── 2. 상품 채팅방 ────────────────────────────────────────────────────
    const myRoomIds = (myParticipations ?? []).map((p) => p.room_id)

    if (myRoomIds.length > 0) {
      const { data: prodRooms } = await admin
        .from('chat_rooms')
        .select(`
          room_id,
          product_id,
          package_session_id,
          product_titles,
          products (title, status),
          chat_participants (uid, users!uid (nickname)),
          chat_messages (original_text, created_at, sender_uid)
        `)
        .not('product_id', 'is', null)
        .in('room_id', myRoomIds)

      const seenProducts = new Set<string>()
      const sortedRooms = [...(prodRooms ?? [])].sort((a, b) => b.room_id - a.room_id)

      for (const r of sortedRooms) {
        const productId = r.product_id as string
        if (seenProducts.has(productId)) continue
        seenProducts.add(productId)

        const product = Array.isArray(r.products) ? r.products[0] : r.products
        const participants = (Array.isArray(r.chat_participants)
          ? r.chat_participants
          : [r.chat_participants]) as unknown as { uid: string; users: { nickname: string } | null }[]
        const counterpart = participants.find((p) => p.uid !== user.id)

        const productRow = product as { title: string; status: string } | null
        const productStatus = productRow?.status ?? 'selling'
        const storedTitles = r.product_titles as string[] | null
        const subtitle = storedTitles && storedTitles.length > 1
          ? storedTitles.join(', ')
          : (productRow?.title ?? '상품')

        const msgs = (Array.isArray(r.chat_messages) ? r.chat_messages : []) as { original_text: string | null; created_at: string; sender_uid: string }[]
        const latest = msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

        const lastRead = lastReadMap.get(r.room_id) ?? null
        const unread_count = msgs.filter((msg) =>
          msg.sender_uid !== user.id &&
          (!lastRead || new Date(msg.created_at) > new Date(lastRead))
        ).length

        results.push({
          key: `prod-${r.room_id}`,
          room_id: r.room_id,
          status: productStatus === 'sold' ? 'sold' : 'active',
          subtitle,
          counterpart_name: counterpart?.users?.nickname ?? '알 수 없음',
          last_message: latest?.original_text ?? null,
          last_message_at: latest?.created_at ?? null,
          unread_count,
          package_session_id: (r.package_session_id as string | null) ?? null,
        })
      }
    }

    results.sort((a, b) => {
      if (!a.last_message_at && !b.last_message_at) return 0
      if (!a.last_message_at) return 1
      if (!b.last_message_at) return -1
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    })

    return NextResponse.json({ data: results, error: null })
  } catch (err) {
    console.error('[chat/list] 예상치 못한 오류:', err)
    return NextResponse.json({ data: null, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
