import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">새 비밀번호 설정</h1>
      <p className="text-sm text-gray-500 mb-6">메일 링크로 들어온 뒤 새 비밀번호를 입력하세요.</p>
      <ResetPasswordForm />
    </div>
  )
}
