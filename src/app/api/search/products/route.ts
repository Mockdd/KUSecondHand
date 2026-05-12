import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { searchProducts } from '@/lib/search/hybridSearch'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)

  if (!q) return NextResponse.json({ data: [], query: '' })

  try {
    const supabase = createServiceRoleClient()
    if (!supabase) return NextResponse.json({ error: 'DB 연결 실패' }, { status: 503 })
    const data = await searchProducts(supabase, q, limit)
    return NextResponse.json({ data, query: q })
  } catch (err) {
    console.error('[search/products]', err)
    return NextResponse.json({ error: '검색 중 오류가 발생했어요' }, { status: 500 })
  }
}
