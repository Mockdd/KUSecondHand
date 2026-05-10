'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { setPendingEmailOtpNext } from '@/lib/auth/otp-session-redirect'
import { isAllowedSchoolEmail } from '@/constants/schoolDomains'

/** 로그인 아이디 = 이메일. 본인 확인용 OTP만 발송 */
export function FindIdForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
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
        next: `/find-id/verify?email=${encodeURIComponent(trimmed)}`,
      }),
    })
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    setLoading(false)

    if (!res.ok) {
      setError(j.error ?? '인증을 보낼 수 없습니다.')
      return
    }

    const nextPath = `/find-id/verify?email=${encodeURIComponent(trimmed)}`
    setPendingEmailOtpNext(nextPath)

    router.push(nextPath)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        가입 여부 확인을 위해 인증번호를 보냅니다. 인증 후 <strong>로그인 아이디는 이메일 주소</strong>임을
        안내합니다.
      </p>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          학교 이메일
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="아이디@korea.ac.kr"
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
        {loading ? '발송 중…' : '인증번호 받기'}
      </button>
      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          로그인
        </Link>
      </p>
    </form>
  )
}
