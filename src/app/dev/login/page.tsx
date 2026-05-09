'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@lib/supabase/client'

export default function DevLoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push('/dev/me')
    router.refresh()
  }

  async function handleSignIn() {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push('/dev/me')
    router.refresh()
  }

  return (
    <div className="max-w-sm mx-auto p-6 space-y-3">
      <h1 className="text-lg font-semibold">Dev 로그인</h1>
      <p className="text-xs text-gray-500">
        옆 팀의 정식 인증 UI 가 완성되면 삭제될 임시 페이지.
      </p>

      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border rounded px-2 py-1 w-full"
        autoComplete="email"
      />
      <input
        type="password"
        placeholder="비밀번호 (6자 이상)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border rounded px-2 py-1 w-full"
        autoComplete="current-password"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading || !email || !password}
          className="border rounded px-3 py-1 disabled:opacity-50"
        >
          로그인
        </button>
        <button
          type="button"
          onClick={handleSignUp}
          disabled={loading || !email || !password}
          className="border rounded px-3 py-1 disabled:opacity-50"
        >
          회원가입
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 break-words">{error}</p>
      )}
    </div>
  )
}
