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

      {/* 맞춤 추천 */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">맞춤 추천</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/recommendations"
            className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-[#8B0029] hover:text-[#8B0029] transition-colors"
          >
            <span className="text-sm font-medium">시간표 추천</span>
            <span className="text-xs text-gray-400">수강 과목 기반 물품 추천</span>
          </Link>
          <Link
            href="/recommend/package"
            className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-[#8B0029] hover:text-[#8B0029] transition-colors"
          >
            <span className="text-sm font-medium">패키지 추천</span>
            <span className="text-xs text-gray-400">학과·학년 기반 묶음 추천</span>
          </Link>
        </div>
      </div>

      <ExchangeProfileSection />

      <SignOutButton />
    </div>
  )
}
