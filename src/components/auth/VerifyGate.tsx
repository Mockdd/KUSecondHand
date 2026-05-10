'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { VerifyForm } from '@/components/auth/VerifyForm'

export function VerifyGate() {
  const searchParams = useSearchParams()
  const raw = searchParams.get('email')
  const email = raw?.trim() ?? null

  if (!email) {
    return (
      <div className="text-center text-sm text-gray-600">
        <p className="mb-3">이메일 정보가 없습니다. 회원가입에서 이메일을 먼저 입력해 주세요.</p>
        <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
          회원가입으로 돌아가기
        </Link>
      </div>
    )
  }

  return <VerifyForm email={email} />
}
