import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// transactions 테이블은 RLS로 당사자만 읽을 수 있어서 service_role로 집계
export async function GET(req: NextRequest) {
  const categoryId = Number(req.nextUrl.searchParams.get('category_id'))
  if (!categoryId || isNaN(categoryId)) {
    return NextResponse.json({ error: 'category_id required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: products } = await supabase
    .from('products')
    .select('pid')
    .eq('category_id', categoryId)
    .is('deleted_at', null)

  if (!products || products.length === 0) {
    return NextResponse.json({ avg_price: null, count: 0 })
  }

  const pids = products.map((p) => p.pid)

  const { data: txns, error } = await supabase
    .from('transactions')
    .select('agreed_price')
    .in('pid', pids)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20)

  if (error || !txns || txns.length === 0) {
    return NextResponse.json({ avg_price: null, count: 0 })
  }

  const avg_price = Math.round(
    txns.reduce((sum, t) => sum + t.agreed_price, 0) / txns.length
  )

  return NextResponse.json({ avg_price, count: txns.length })
}
