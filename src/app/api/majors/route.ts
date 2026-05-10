import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 전공 마스터 (테이블이 없거나 조회 실패 시 빈 배열) */
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('majors')
    .select('major_id, name')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ majors: [] })
  }

  return NextResponse.json({ majors: data ?? [] })
}
