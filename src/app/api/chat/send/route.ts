import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { translateText } from '@/lib/deepl/translate'
import type { LanguagePrefEnum } from '@/types/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

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
    const body = (await request.json()) as {
      room_id: number
      match_id: number
      content: string
      source_lang: LanguagePrefEnum
      target_lang: LanguagePrefEnum
    }

    const { room_id, match_id, content, source_lang, target_lang } = body

    if (!room_id || !match_id || !content?.trim()) {
      return NextResponse.json(
        { data: null, error: { code: 'INVALID_REQUEST', message: '필수 파라미터가 없어요' } },
        { status: 400 }
      )
    }

    // 3. 채팅방 참여자 확인
    const { data: participant } = await supabase
      .from('chat_participants')
      .select('id')
      .eq('room_id', room_id)
      .eq('uid', user.id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json(
        { data: null, error: { code: 'FORBIDDEN', message: '접근 권한이 없어요' } },
        { status: 403 }
      )
    }

    // 4. DeepL 번역 (실패 시 null → 원문만 저장)
    const translated_text = await translateText(content.trim(), target_lang)

    // 5. 메시지 INSERT
    const { data: message, error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        room_id,
        sender_uid: user.id,
        data: { type: 'text', content: content.trim() },
        original_text: content.trim(),
        translated_text: translated_text ?? null,
        source_lang,
        target_lang,
      })
      .select('id, original_text, translated_text, source_lang, target_lang')
      .single()

    if (msgError) {
      console.error('[chat/send] 메시지 저장 실패:', msgError)
      return NextResponse.json(
        { data: null, error: { code: 'INTERNAL_ERROR', message: '메시지 전송에 실패했어요' } },
        { status: 500 }
      )
    }

    // 6. pending → matched 상태 업데이트 (첫 메시지 전송 시)
    await supabase
      .from('package_matches')
      .update({ status: 'matched' })
      .eq('match_id', match_id)
      .eq('status', 'pending')

    return NextResponse.json({
      data: {
        message_id: message.id,
        original_text: message.original_text,
        translated_text: message.translated_text,
        source_lang: message.source_lang,
        target_lang: message.target_lang,
        translation_available: translated_text !== null,
      },
      error: null,
    })
  } catch (err) {
    console.error('[chat/send] 예상치 못한 오류:', err)
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했어요' } },
      { status: 500 }
    )
  }
}
