import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 내가 등록한 상품 목록 (삭제되지 않은 행만) */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('products')
    .select('pid, title, price, status, condition, created_at, product_images(image_url, display_order)')
    .eq('seller_uid', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ products: data ?? [] })
}
