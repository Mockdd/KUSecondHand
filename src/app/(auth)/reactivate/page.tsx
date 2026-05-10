import { Suspense } from 'react'
import { ReactivateForm } from '@/components/auth/ReactivateForm'

export default function ReactivatePage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">휴면 계정 해제</h1>
      <p className="text-sm text-gray-500 mb-6">
        장기 미접속으로 휴면 처리된 계정입니다. 이메일 인증으로 다시 이용할 수 있습니다.
      </p>
      <Suspense fallback={<p className="text-sm text-gray-500">불러오는 중…</p>}>
        <ReactivateForm />
      </Suspense>
    </div>
  )
}
