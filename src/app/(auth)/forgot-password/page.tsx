import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-[#8B0029] mb-2">비밀번호 찾기</h1>
      <p className="text-sm text-gray-500 mb-6">이메일 인증으로 재설정합니다.</p>
      <ForgotPasswordForm />
    </div>
  )
}
