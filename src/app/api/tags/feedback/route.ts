import { NextRequest, NextResponse } from 'next/server'

import { createServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { TagFeedbackRequest, TagFeedbackResponse } from '@/types/feedback'

const MAX_TAGS = 10
const MAX_TAG_LENGTH = 30

function normalizeTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null

  const seen = new Set<string>()
  const tags: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') return null
    const tag = item.trim()
    if (!tag || tag.length > MAX_TAG_LENGTH || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }

  return tags
}

function diffTags(base: string[], target: string[]): string[] {
  const baseSet = new Set(base)
  return target.filter((tag) => !baseSet.has(tag))
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: Partial<TagFeedbackRequest>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { productId, modelVersionId, sessionDurationMs } = body
  const predictedTags = normalizeTags(body.predictedTags)
  const finalTags = normalizeTags(body.finalTags)

  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'productId 가 필요합니다.' }, { status: 400 })
  }
  if (!predictedTags || !finalTags) {
    return NextResponse.json({ error: '태그 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  if (
    typeof modelVersionId !== 'number' ||
    !Number.isInteger(modelVersionId) ||
    modelVersionId < 0
  ) {
    return NextResponse.json({ error: 'modelVersionId 가 필요합니다.' }, { status: 400 })
  }
  if (
    typeof sessionDurationMs !== 'number' ||
    !Number.isFinite(sessionDurationMs) ||
    sessionDurationMs < 0
  ) {
    return NextResponse.json({ error: 'sessionDurationMs 가 필요합니다.' }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { error: '서버 설정 오류: Supabase 서비스 키가 없습니다.' },
      { status: 500 },
    )
  }

  const addedTags = diffTags(predictedTags, finalTags)
  const removedTags = diffTags(finalTags, predictedTags)

  const { data: product, error: productError } = await admin
    .from('products')
    .select('pid, seller_uid')
    .eq('pid', productId)
    .maybeSingle()

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ error: '매물을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (product.seller_uid !== user.id) {
    return NextResponse.json({ error: '본인 매물에만 태그 피드백을 남길 수 있습니다.' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('tag_feedback_logs')
    .insert({
      user_id: user.id,
      product_id: productId,
      predicted_tags: predictedTags,
      final_tags: finalTags,
      added_tags: addedTags,
      removed_tags: removedTags,
      model_version_id: modelVersionId > 0 ? modelVersionId : null,
      session_duration_ms: Math.round(sessionDurationMs),
    })
    .select('feedback_log_id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const response: TagFeedbackResponse = {
    success: true,
    logId: data.feedback_log_id,
  }

  return NextResponse.json(response)
}
