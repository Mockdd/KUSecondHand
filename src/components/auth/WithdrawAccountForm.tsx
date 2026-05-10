'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function WithdrawAccountForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (confirmText.trim() !== '탈퇴') {
      setError('확인란에 「탈퇴」를 정확히 입력하세요.')
      return
    }
    if (!password) {
      setError('비밀번호를 입력하세요.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string }

    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? '탈퇴 처리에 실패했습니다.')
      return
    }

    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login?withdrawn=1')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-red-100 rounded-xl p-4 bg-red-50/50">
      <p className="text-sm text-gray-700">
        탈퇴 시 계정이 비활성화되며, 동일 메일로 재가입 정책은 서비스 정책에 따릅니다.
      </p>
      <div>
        <label htmlFor="withdrawPw" className="block text-sm font-medium text-gray-700 mb-1">
          비밀번호 확인
        </label>
        <input
          id="withdrawPw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
          disabled={loading}
        />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
          확인을 위해 <strong>탈퇴</strong> 입력
        </label>
        <input
          id="confirm"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="탈퇴"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
          disabled={loading}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
      >
        {loading ? '처리 중…' : '회원 탈퇴'}
      </button>
    </form>
  )
}
