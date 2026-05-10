import { Suspense } from 'react'
import { VerifyGate } from '@/components/auth/VerifyGate'

export default function VerifyPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">이메일 인증</h1>
      <p className="text-sm text-gray-500 mb-6">
        메일에 온 <strong className="text-gray-700">6자리 인증번호</strong>만 이 페이지에 입력합니다. 메일 속
        버튼·링크는 사용하지 않아도 됩니다.
      </p>
      <Suspense
        fallback={<p className="text-sm text-gray-500">불러오는 중…</p>}
      >
        <VerifyGate />
      </Suspense>
    </div>
  )
}
