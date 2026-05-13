'use client'

import { useState } from 'react'
import Link from 'next/link'
import { setPendingEmailOtpNext } from '@/lib/auth/otp-session-redirect'
import { isAllowedSchoolEmail } from '@/constants/schoolDomains'

export function RegisterForm() {
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
      setError('고려대학교 메일(@korea.ac.kr)만 사용할 수 있습니다.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: trimmed, mode: 'signup' }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        setError(j.error ?? '인증번호를 보내지 못했습니다.')
        return
      }

      const verifyPath = `/verify?email=${encodeURIComponent(trimmed)}`
      setPendingEmailOtpNext(verifyPath)

      // Client router 전환만으로 /verify 에 안 붙는 환경 대비
      window.location.assign(verifyPath)
    } catch {
      setError('네트워크 오류로 요청을 완료하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
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
          placeholder="아이디@korea.ac.kr"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
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
        className="w-full rounded-lg bg-[#8B0029] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B0020] disabled:opacity-50"
      >
        {loading ? '발송 중…' : '인증번호 받기'}
      </button>

      <p className="text-center text-sm text-gray-500">
        이미 계정이 있나요?{' '}
        <Link href="/login" className="font-medium text-[#8B0029] hover:text-[#6B0020]">
          로그인
        </Link>
      </p>
    </form>
  )
}
