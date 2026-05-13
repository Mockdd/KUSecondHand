import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-[#8B0029] mb-2">회원가입</h1>
      <p className="text-sm text-gray-500 mb-6">
        <span className="font-medium text-gray-700">@korea.ac.kr</span> 메일로 인증번호를 받은 뒤 정보를 입력합니다.
      </p>
      <RegisterForm />
    </div>
  )
}
