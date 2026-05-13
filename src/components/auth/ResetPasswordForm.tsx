'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PASSWORD_MIN_LENGTH, validatePassword } from '@/lib/auth/validate'

export function ResetPasswordForm() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errPw = validatePassword(password)
    if (errPw) {
      setError(errPw)
      return
    }
    if (password !== password2) {
      setError('비밀번호가 서로 일치하지 않습니다.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updErr } = await supabase.auth.updateUser({ password })

    if (updErr) {
      setLoading(false)
      setError(updErr.message)
      return
    }

    await fetch('/api/auth/sync-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include',
    })

    await supabase.auth.signOut()
    setLoading(false)

    router.push('/login?reset=ok')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {!ready ? (
        <p className="text-sm text-gray-600">메일의 링크를 통해 이 페이지로 들어오면 새 비밀번호를 설정할 수 있습니다.</p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            새 비밀번호 ({PASSWORD_MIN_LENGTH}자 이상)
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
            disabled={loading || !ready}
          />
        </div>
        <div>
          <label htmlFor="password2" className="block text-sm font-medium text-gray-700 mb-1">
            새 비밀번호 확인
          </label>
          <input
            id="password2"
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
            disabled={loading || !ready}
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading || !ready}
          className="w-full rounded-lg bg-[#8B0029] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B0020] disabled:opacity-50"
        >
          {loading ? '저장 중…' : '비밀번호 변경'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-[#8B0029] hover:text-[#6B0020]">
          로그인
        </Link>
      </p>
    </div>
  )
}
