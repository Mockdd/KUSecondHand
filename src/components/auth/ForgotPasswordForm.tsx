'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isAllowedSchoolEmail } from '@/constants/schoolDomains'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
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
    const supabase = createClient()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${origin}/reset-password`,
    })
    setLoading(false)

    if (resetErr) {
      setError(resetErr.message)
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-lg border border-[#8B0029]/15 bg-[#8B0029]/[0.06] px-4 py-3 text-sm text-gray-800">
        입력하신 메일로 비밀번호 재설정 링크를 보냈습니다. 메일함을 확인한 뒤 링크를 눌러 새 비밀번호를
        설정해 주세요.
        <p className="mt-3">
          <Link href="/login" className="font-medium text-[#8B0029] hover:text-[#6B0020]">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        가입 시 사용한 <strong>@korea.ac.kr</strong> 주소를 입력하면 비밀번호 재설정 메일을 보냅니다.
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
        {loading ? '발송 중…' : '재설정 메일 보내기'}
      </button>
      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-[#8B0029] hover:text-[#6B0020]">
          로그인
        </Link>
      </p>
    </form>
  )
}
