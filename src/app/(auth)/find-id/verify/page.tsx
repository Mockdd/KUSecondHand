import { Suspense } from 'react'
import { FindIdVerifyGate } from '@/components/auth/FindIdVerifyGate'

export default function FindIdVerifyPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-[#8B0029] mb-2">아이디 찾기 인증</h1>
      <p className="text-sm text-gray-500 mb-6">메일로 받은 인증번호를 입력하세요.</p>
      <Suspense fallback={<p className="text-sm text-gray-500">불러오는 중…</p>}>
        <FindIdVerifyGate />
      </Suspense>
    </div>
  )
}
