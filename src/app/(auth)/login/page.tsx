import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-[#8B0029] mb-6">로그인</h1>
      <Suspense fallback={<p className="text-sm text-gray-400">불러오는 중…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
