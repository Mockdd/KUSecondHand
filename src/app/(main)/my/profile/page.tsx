import Link from 'next/link'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { ExchangeProfileSection } from '@/components/profile/ExchangeProfileSection'
import { SignOutButton } from '@/components/auth/SignOutButton'

export default function ProfilePage() {
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#8B0029] mb-2">마이페이지</h1>
      </div>

      <ProfileForm />

      {/* 맞춤 추천 */}
      <div className="rounded-xl border border-[#8B0029]/15 bg-[#8B0029]/[0.04] p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#8B0029]">맞춤 추천</h2>
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

      <SignOutButton />

      <details className="rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-gray-800">
          교환학생이신가요?
        </summary>
        <div className="mt-4">
          <ExchangeProfileSection />
        </div>
      </details>

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
