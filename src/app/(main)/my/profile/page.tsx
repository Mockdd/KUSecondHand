import Link from 'next/link'
import { ProfileForm } from '@/components/profile/ProfileForm'

export default function ProfilePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">내 프로필</h1>
      <p className="text-sm mb-6">
        <Link href="/my/account" className="text-indigo-600 hover:text-indigo-500">
          계정 관리 (탈퇴)
        </Link>
      </p>
      <ProfileForm />
    </div>
  )
}
