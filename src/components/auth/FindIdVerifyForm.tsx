'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  normalizeOtp,
  OTP_DIGIT_MAX,
  OTP_INPUT_PLACEHOLDER,
  validateOtpDigits,
} from '@/lib/auth/validate'

type Props = {
  email: string
}

export function FindIdVerifyForm({ email }: Props) {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [magicLinkSession, setMagicLinkSession] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled && user?.email?.toLowerCase() === email.toLowerCase()) setMagicLinkSession(true)
    })()
    return () => {
      cancelled = true
    }
  }, [email])

  async function revealFromMagicLink() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    setRevealed(true)
    await supabase.auth.signOut()
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const code = normalizeOtp(otp)
    const otpErr = validateOtpDigits(code)
    if (otpErr) {
      setError(otpErr)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    setLoading(false)

    if (verifyErr) {
      setError(verifyErr.message)
      return
    }

    setRevealed(true)
    await supabase.auth.signOut()
  }

  if (revealed) {
    return (
      <div className="rounded-lg border border-[#8B0029]/15 bg-[#8B0029]/[0.06] px-4 py-4 text-sm text-gray-800 space-y-2">
        <p className="font-medium text-[#8B0029]">본인 확인이 완료되었습니다.</p>
        <p>
          이 서비스에서 <strong>로그인 아이디는 이메일 주소</strong>입니다.
        </p>
        <p className="break-all font-mono text-gray-900 bg-white/60 rounded px-2 py-1">{email}</p>
        <p className="pt-2">
          <Link href="/login" className="font-medium text-[#8B0029] hover:text-[#6B0020]">
            로그인하기
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600 break-all">
        <span className="font-medium text-gray-800">{email}</span> 로 인증번호를 보냈습니다.
      </p>
      {magicLinkSession ? (
        <div className="rounded-lg border border-[#8B0029]/20 bg-[#8B0029]/[0.06] px-3 py-2 text-sm text-gray-800">
          메일의 링크로 이미 로그인된 상태입니다. 번호 없이 아이디 확인을 누르세요.
          <button
            type="button"
            onClick={() => void revealFromMagicLink()}
            disabled={loading}
            className="mt-2 block w-full rounded-lg bg-[#8B0029] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B0020] disabled:opacity-50"
          >
            인증 확인 (아이디 보기)
          </button>
        </div>
      ) : null}
      <div>
        <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
          인증번호 (메일과 동일)
        </label>
        <input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_DIGIT_MAX}
          value={otp}
          onChange={(e) => setOtp(normalizeOtp(e.target.value))}
          placeholder={OTP_INPUT_PLACEHOLDER}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 tracking-widest text-center text-lg font-mono shadow-sm focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
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
        {loading ? '확인 중…' : '확인'}
      </button>
      <p className="text-center text-sm text-gray-500">
        <Link href="/find-id" className="font-medium text-[#8B0029] hover:text-[#6B0020]">
          이메일 다시 입력
        </Link>
      </p>
    </form>
  )
}
