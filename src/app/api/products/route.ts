import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { productListSelect } from '@/lib/products/sellerEmbed'
import { createEmbedding, buildProductEmbeddingText } from '@/lib/openai/embeddings'
import type { ProductConditionEnum } from '@/types/supabase'

const PRODUCT_CONDITIONS: ProductConditionEnum[] = ['high', 'medium', 'low']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') ?? '0')
  const limit = 20
  const from = page * limit
  const to = from + limit - 1

  const { data, error } = await supabase
    .from('products')
    .select(productListSelect())
    .is('deleted_at', null)
    .eq('status', 'selling')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })

  const { title, price, condition, category_id, description, image_urls } = body as {
    title: string
    price: number
    condition: string
    category_id: number
    description?: string
    image_urls?: string[]
  }

  if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
  if (typeof price !== 'number' || price < 0) return NextResponse.json({ error: '올바른 가격을 입력해주세요.' }, { status: 400 })
  if (!PRODUCT_CONDITIONS.includes(condition as ProductConditionEnum)) {
    return NextResponse.json({ error: '상태를 선택해주세요.' }, { status: 400 })
  }
  const productCondition = condition as ProductConditionEnum
  if (!category_id) return NextResponse.json({ error: '카테고리를 선택해주세요.' }, { status: 400 })

  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({
      seller_uid: user.id,
      title: title.trim(),
      price,
      condition: productCondition,
      category_id,
      description: description?.trim() || null,
    })
    .select('pid')
    .single()

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })

  if (image_urls && image_urls.length > 0) {
    const images = image_urls.map((url, i) => ({
      pid: product.pid,
      image_url: url,
      display_order: i,
    }))
    const { error: imgError } = await supabase.from('product_images').insert(images)
    if (imgError) return NextResponse.json({ error: imgError.message }, { status: 500 })
  }

  // embedding 생성 (실패해도 등록은 완료 — 검색에서만 누락)
  try {
    const embeddingText = buildProductEmbeddingText(title.trim(), description)
    const embedding = await createEmbedding(embeddingText)
    await supabase.from('product_embeddings').upsert({
      pid: product.pid,
      embedding: JSON.stringify(embedding),
      embedded_at: new Date().toISOString(),
    })
  } catch (embErr) {
    console.error('[api/products] embedding 생성 실패:', embErr)
  }

  return NextResponse.json({ pid: product.pid }, { status: 201 })
}
