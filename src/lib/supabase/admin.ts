import { createClient } from '@supabase/supabase-js'

// Route Handler / Server Action 전용 — 클라이언트에서 절대 사용 금지
export const createAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
