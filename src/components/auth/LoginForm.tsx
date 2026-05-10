'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isAllowedSchoolEmail } from '@/constants/schoolDomains'
import { sanitizeNextPath } from '@/lib/safe-redirect-path'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bannerWithdrawn = searchParams.get('withdrawn') === '1'
  const bannerReset = searchParams.get('reset') === 'ok'
  const nextPath = sanitizeNextPath(searchParams.get('next'), '/products')

  useEffect(() => {
    if (searchParams.get('reason') === 'withdrawn') {
      void createClient().auth.signOut()
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !password) {
      setError('이메일과 비밀번호를 입력하세요.')
      return
    }
    if (!isAllowedSchoolEmail(trimmed)) {
      setError('고려대학교 메일(@korea.ac.kr)만 로그인할 수 있습니다.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })

    if (signError) {
      setLoading(false)
      setError(signError.message)
      return
    }

    const statusRes = await fetch('/api/account/status', { credentials: 'include' })
    const st = (await statusRes.json().catch(() => ({}))) as {
      deleted?: boolean
      dormant?: boolean
      profileMissing?: boolean
    }

    if (st.deleted) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('탈퇴된 계정입니다.')
      return
    }

    if (st.dormant) {
      await supabase.auth.signOut()
      setLoading(false)
      router.push(`/reactivate?email=${encodeURIComponent(trimmed)}`)
      return
    }

    await fetch('/api/auth/touch-activity', { method: 'POST', credentials: 'include' })

    setLoading(false)
    router.push(nextPath)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {bannerReset ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.
        </p>
      ) : null}
      {bannerWithdrawn ? (
        <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
          탈퇴 처리가 완료되었습니다.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            학교 이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? '로그인 중…' : '로그인'}
        </button>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-gray-500">
          <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
            비밀번호 찾기
          </Link>
          <Link href="/find-id" className="font-medium text-indigo-600 hover:text-indigo-500">
            아이디 찾기
          </Link>
        </div>

        <p className="text-center text-sm text-gray-500">
          계정이 없나요?{' '}
          <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            회원가입
          </Link>
        </p>
      </form>
    </div>
  )
}
