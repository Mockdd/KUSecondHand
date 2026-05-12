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
      className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-600 hover:bg-gray-50"
    >
      로그아웃
    </button>
  )
}
