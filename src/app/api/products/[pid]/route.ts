import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { productDetailSelect } from '@/lib/products/sellerEmbed'

export async function GET(_: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select(productDetailSelect())
    .eq('pid', pid)
    .is('deleted_at', null)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  // TODO: Phase 3 — 상품 수정 (인증 확인 + seller_uid 검증 필요)
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params
  const supabase = await createClient()

  // Soft Delete
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('pid', pid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: '삭제되었습니다.' })
}
