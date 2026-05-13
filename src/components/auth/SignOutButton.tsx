'use client'

import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <button
      onClick={handleSignOut}
      className="px-4 py-2 border border-[#8B0029]/35 text-sm rounded-lg font-medium text-[#8B0029] hover:bg-[#8B0029]/5"
    >
      로그아웃
    </button>
  )
}
