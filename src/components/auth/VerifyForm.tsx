'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  normalizeOtp,
  PASSWORD_MIN_LENGTH,
  validateNickname,
  validatePassword,
  validateStudentId,
} from '@/lib/auth/validate'

type Props = {
  email: string
}

export function VerifyForm({ email }: Props) {
  const router = useRouter()
  /** 매직링크로 이미 세션이 잡혀 있으면 OTP 생략 (비번·프로필만 제출) */
  const [sessionReady, setSessionReady] = useState(false)
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [nickname, setNickname] = useState('')
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (user?.email?.toLowerCase() === email.toLowerCase()) setSessionReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [email])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const code = normalizeOtp(otp)
    if (!sessionReady && code.length !== 6) {
      setError('인증번호 6자리를 입력하세요.')
      return
    }

    const pwErr = validatePassword(password)
    if (pwErr) {
      setError(pwErr)
      return
    }
    if (password !== password2) {
      setError('비밀번호가 서로 일치하지 않습니다.')
      return
    }

    const nnErr = validateNickname(nickname)
    if (nnErr) {
      setError(nnErr)
      return
    }

    const sidErr = validateStudentId(studentId)
    if (sidErr) {
      setError(sidErr)
      return
    }

    setLoading(true)
    const supabase = createClient()

    if (!sessionReady) {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      })

      if (verifyErr) {
        setLoading(false)
        setError(verifyErr.message)
        return
      }
    }

    const res = await fetch('/api/auth/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: nickname.trim(),
        student_id: studentId.trim(),
        password,
      }),
    })

    const json = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }

    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? '가입 처리에 실패했습니다.')
      return
    }

    await fetch('/api/auth/touch-activity', { method: 'POST', credentials: 'include' })

    router.push('/products')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600 break-all">
        <span className="font-medium text-gray-800">{email}</span>
        {sessionReady
          ? ' — 링크로 인증된 상태입니다. 아래 정보를 채워 가입을 완료해 주세요.'
          : ' 로 인증메일을 보냈습니다. 메일에 표시된 6자리 코드를 입력하세요.'}
      </p>

      {sessionReady ? null : (
        <div>
          <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
            인증번호 (6자리)
          </label>
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(normalizeOtp(e.target.value))}
            placeholder="000000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 tracking-widest text-center text-lg font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          비밀번호 ({PASSWORD_MIN_LENGTH}자 이상)
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="password2" className="block text-sm font-medium text-gray-700 mb-1">
          비밀번호 확인
        </label>
        <input
          id="password2"
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
          닉네임
        </label>
        <input
          id="nickname"
          type="text"
          autoComplete="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
          학번
        </label>
        <input
          id="studentId"
          type="text"
          inputMode="numeric"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
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
        {loading ? '처리 중…' : '가입 완료'}
      </button>

      <p className="text-center text-sm text-gray-500">
        <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
          이메일 다시 입력
        </Link>
      </p>
    </form>
  )
}
