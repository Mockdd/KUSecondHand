import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ authenticated: false })
  }

  const { data, error } = await supabase
    .from('users')
    .select('deleted_at, dormant_at')
    .eq('uid', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { authenticated: true, deleted: false, dormant: false, profileMissing: true },
      { status: 200 },
    )
  }

  const deleted = !!data?.deleted_at
  const dormant = !!data?.dormant_at

  return NextResponse.json({
    authenticated: true,
    deleted,
    dormant,
    profileMissing: !data,
  })
}
