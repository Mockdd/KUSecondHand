import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // TODO: Phase 5 — 신고 접수 구현
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
}
