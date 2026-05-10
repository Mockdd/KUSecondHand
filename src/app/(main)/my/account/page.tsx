import Link from 'next/link'
import { WithdrawAccountForm } from '@/components/auth/WithdrawAccountForm'

export default function AccountSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/my/profile" className="text-sm text-indigo-600 hover:text-indigo-500">
          ← 프로필로 돌아가기
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">계정 관리</h1>
        <p className="text-sm text-gray-500 mt-1">비밀번호 찾기·아이디 찾기는 모두 로그인 화면의 이메일 인증 링크를 이용합니다.</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">회원 탈퇴</h2>
        <WithdrawAccountForm />
      </section>
    </div>
  )
}
