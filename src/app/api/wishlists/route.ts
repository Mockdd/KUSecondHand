import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('wishlists')
    .select('wishlist_id, pid, created_at, products(pid, title, price, condition, product_images(image_url, display_order))')
    .eq('uid', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ wishlists: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json()
  const { pid } = body as { pid?: string }
  if (!pid) return NextResponse.json({ error: 'pid required' }, { status: 400 })

  const { error } = await supabase
    .from('wishlists')
    .insert({ uid: user.id, pid })

  if (error) {
    // unique violation = already wishlisted
    if (error.code === '23505') return NextResponse.json({ ok: true, alreadyExists: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
