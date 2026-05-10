import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">로그인</h1>
      <p className="text-sm text-gray-500 mb-6">
        가입 시 사용한 <span className="font-medium text-gray-700">@korea.ac.kr</span> 메일과 비밀번호를 입력하세요.
      </p>
      <Suspense fallback={<p className="text-sm text-gray-400">불러오는 중…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
