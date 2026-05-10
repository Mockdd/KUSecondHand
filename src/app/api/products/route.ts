import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { productListSelect } from '@/lib/products/sellerEmbed'

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
  // TODO: Phase 3 — 상품 등록
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
