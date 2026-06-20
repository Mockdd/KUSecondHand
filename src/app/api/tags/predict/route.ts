import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import OpenAI from 'openai'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { TagPredictRequest, TagPredictResponse } from '@/types/feedback'

/**
 * 태그 예측 API.
 *
 * 흐름:
 *   1. 이미지 URL 해시 계산 → 캐시 조회 (24h TTL)
 *   2. 캐시 hit  → 즉시 반환
 *   3. 캐시 miss → 활성 모델로 OpenAI Vision 호출 → 캐시 저장 → 반환
 *
 * 활성 모델이 없으면 베이스 fallback (`gpt-4o-mini`) 사용.
 */

const MAX_TAGS = 8
const OPENAI_TIMEOUT_MS = 15_000

const SYSTEM_PROMPT = `당신은 한국 대학생 중고거래 플랫폼의 태그 추천 도우미입니다.
이미지를 보고 해당 상품에 어울리는 한국어 태그를 최대 ${MAX_TAGS}개 추천하세요.

규칙:
- 각 태그는 1~10자 이내의 짧은 한국어 단어 또는 구
- 카테고리(예: 전자기기, 도서), 상태(예: 새상품, 미개봉), 특징(예: 가죽, 무선) 위주
- 브랜드명은 명확히 보일 때만 포함
- 응답은 JSON 배열 형식: ["태그1", "태그2", ...]
- 다른 텍스트 없이 JSON 배열만 출력`

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function parseTagsFromResponse(text: string): string[] | null {
  try {
    const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return null
    return parsed
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 20)
      .slice(0, MAX_TAGS)
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  // ─── 1. 요청 파싱 ─────────────────────────────────────────────
  let body: Partial<TagPredictRequest>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { imageUrl, productId } = body
  if (!imageUrl || typeof imageUrl !== 'string') {
    return NextResponse.json({ error: 'imageUrl 이 필요합니다.' }, { status: 400 })
  }
  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'productId 가 필요합니다.' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  if (!supabase) {
    return NextResponse.json(
      { error: '서버 설정 오류: Supabase 서비스 키가 없습니다.' },
      { status: 500 }
    )
  }

  // ─── 2. 활성 모델 조회 (없으면 fallback) ─────────────────────
  const { data: activeModel } = await supabase
    .from('model_versions')
    .select('model_version_id, openai_model_id, version_label')
    .eq('is_active', true)
    .maybeSingle()

  const modelId = activeModel?.openai_model_id ?? 'gpt-4o-mini'
  const modelVersionId = activeModel?.model_version_id ?? null
  const modelLabel = activeModel?.version_label ?? 'fallback-base'

  // ─── 3. 캐시 조회 ────────────────────────────────────────────
  const hash = sha256Hex(imageUrl)
  const { data: cached } = await supabase
    .from('tag_prediction_cache')
    .select('tags, model_version_id, expires_at')
    .eq('image_url_hash', hash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached && Array.isArray(cached.tags)) {
    const response: TagPredictResponse = {
      tags: cached.tags,
      modelVersionId: cached.model_version_id ?? modelVersionId ?? 0,
      modelLabel,
      cached: true,
    }
    return NextResponse.json(response)
  }

  // ─── 4. OpenAI Vision 호출 ───────────────────────────────────
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: '서버 설정 오류: OpenAI API 키가 없습니다.' },
      { status: 500 }
    )
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: OPENAI_TIMEOUT_MS,
  })

  let tags: string[]
  try {
    const completion = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: '이 상품 이미지를 분석해서 태그를 추천해주세요.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    })

    const text = completion.choices[0]?.message?.content ?? ''
    const parsed = parseTagsFromResponse(text)

    if (!parsed || parsed.length === 0) {
      return NextResponse.json(
        { error: '태그 추출에 실패했습니다.', detail: 'invalid_response_format' },
        { status: 502 }
      )
    }
    tags = parsed
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json(
      { error: '태그 예측 중 오류가 발생했습니다.', detail: message },
      { status: 502 }
    )
  }

  // ─── 5. 캐시 저장 (실패해도 응답은 정상 반환) ──────────────
  void supabase
    .from('tag_prediction_cache')
    .upsert(
      {
        image_url_hash: hash,
        tags,
        model_version_id: modelVersionId,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'image_url_hash' }
    )
    .then(({ error }) => {
      if (error) console.error('[predict] cache upsert failed:', error.message)
    })

  // ─── 6. 응답 ─────────────────────────────────────────────────
  const response: TagPredictResponse = {
    tags,
    modelVersionId: modelVersionId ?? 0,
    modelLabel,
    cached: false,
  }
  return NextResponse.json(response)
}
