import Link from 'next/link'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { ExchangeProfileSection } from '@/components/profile/ExchangeProfileSection'
import { SignOutButton } from '@/components/auth/SignOutButton'

export default function ProfilePage() {
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">마이페이지</h1>
        <p className="text-sm">
          <Link href="/my/account" className="text-indigo-600 hover:text-indigo-500">
            계정 관리 (탈퇴)
          </Link>
        </p>
      </div>

      <ProfileForm />

      <ExchangeProfileSection />

      <SignOutButton />
    </div>
  )
}
