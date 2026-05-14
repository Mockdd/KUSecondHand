import Link from 'next/link'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { SignOutButton } from '@/components/auth/SignOutButton'

export default function ProfilePage() {
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#8B0029] mb-2">마이페이지</h1>
      </div>

      <ProfileForm />

      <SignOutButton />

      <div className="pt-2 border-t border-gray-200">
        <Link
          href="/my/account"
          className="text-sm font-medium text-red-600 hover:text-red-700"
        >
          회원 탈퇴
        </Link>
      </div>
    </div>
  )
}
