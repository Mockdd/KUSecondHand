import Link from 'next/link'
import { ProfileForm } from '@/components/profile/ProfileForm'

export default function ProfilePage() {
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#8B0029] mb-2">마이페이지</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href="/wishlist?tab=products"
            className="inline-flex items-center justify-center rounded-lg border border-[#8B0029] bg-white px-4 py-2.5 text-sm font-semibold text-[#8B0029] hover:bg-[#8B0029]/5"
          >
            찜 목록 보기
          </Link>
          <Link
            href="/my/listings"
            className="inline-flex items-center justify-center rounded-lg bg-[#8B0029] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B0020]"
          >
            판매 상품 목록 보기
          </Link>
        </div>
      </div>

      <ProfileForm />
    </div>
  )
}
