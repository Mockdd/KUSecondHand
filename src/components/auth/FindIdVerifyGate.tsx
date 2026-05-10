'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FindIdVerifyForm } from '@/components/auth/FindIdVerifyForm'

export function FindIdVerifyGate() {
  const searchParams = useSearchParams()
  const raw = searchParams.get('email')
  const email = raw?.trim() ?? null

  if (!email) {
    return (
      <div className="text-center text-sm text-gray-600">
        <p className="mb-3">이메일 정보가 없습니다.</p>
        <Link href="/find-id" className="font-medium text-indigo-600 hover:text-indigo-500">
          아이디 찾기로 돌아가기
        </Link>
      </div>
    )
  }

  return <FindIdVerifyForm email={email} />
}
