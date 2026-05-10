'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { setPendingEmailOtpNext } from '@/lib/auth/otp-session-redirect'
import { createClient } from '@/lib/supabase/client'
import { isAllowedSchoolEmail } from '@/constants/schoolDomains'
import { normalizeOtp } from '@/lib/auth/validate'

/** 휴면 계정: 이메일 OTP로 본인 확인 후 재활성화 */
export function ReactivateForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get('email')?.trim() ?? ''

  const [email, setEmail] = useState(initialEmail)

  /** 구형 링크(?email=)로 들어온 경우 주소창에서만 제거(상태는 이미 반영됨) */
  useEffect(() => {
    if (!searchParams.get('email')) return
    router.replace('/reactivate', { scroll: false })
  }, [router, searchParams])

  /** URL에 이메일을 두지 않을 때, 로그인 세션에서만 프리필 (미들웨어와 동일 정책) */
  useEffect(() => {
    if (initialEmail) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled && user?.email) setEmail(user.email)
    })()
    return () => {
      cancelled = true
    }
  }, [initialEmail])
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('이메일을 입력하세요.')
      return
    }
    if (!isAllowedSchoolEmail(trimmed)) {
      setError('고려대학교 메일(@korea.ac.kr)만 이용할 수 있습니다.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/send-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        email: trimmed,
        mode: 'signin_existing',
        next: '/reactivate',
      }),
    })
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    setLoading(false)

    if (!res.ok) {
      setError(j.error ?? '인증번호를 보내지 못했습니다.')
      return
    }

    setPendingEmailOtpNext('/reactivate')

    setEmail(trimmed)
    setStep('otp')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const code = normalizeOtp(otp)
    if (code.length !== 6) {
      setError('인증번호 6자리를 입력하세요.')
      return
    }

    setLoading(true)
    const supabase = createClient()
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

    const re = await fetch('/api/auth/reactivate', { method: 'POST' })
    const j = await re.json().catch(() => ({}))
    if (!re.ok) {
      setLoading(false)
      setError((j as { error?: string }).error ?? '재활성화에 실패했습니다.')
      return
    }

    await fetch('/api/auth/touch-activity', { method: 'POST' })
    setLoading(false)
    router.push('/products')
    router.refresh()
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendOtp} className="space-y-4">
        <p className="text-sm text-gray-600">
          휴면 해제를 위해 가입 시 사용한 <strong>@korea.ac.kr</strong> 메일로 인증번호를 보냅니다.
        </p>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            학교 이메일
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? '발송 중…' : '인증번호 받기'}
        </button>
        <p className="text-center text-sm text-gray-500">
          <Link href="/login" className="text-indigo-600 hover:text-indigo-500">
            로그인
          </Link>
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-gray-600 break-all">
        <span className="font-medium">{email}</span> 로 인증번호를 보냈습니다.
      </p>
      <div>
        <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
          인증번호 (6자리)
        </label>
        <input
          id="otp"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(normalizeOtp(e.target.value))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest"
          disabled={loading}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {loading ? '처리 중…' : '휴면 해제하기'}
      </button>
    </form>
  )
}
