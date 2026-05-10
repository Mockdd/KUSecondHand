import { FindIdForm } from '@/components/auth/FindIdForm'

export default function FindIdPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">아이디 찾기</h1>
      <p className="text-sm text-gray-500 mb-6">이메일 인증 후 로그인 아이디를 안내합니다.</p>
      <FindIdForm />
    </div>
  )
}
