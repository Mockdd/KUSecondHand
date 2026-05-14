import { ProfileForm } from '@/components/profile/ProfileForm'

export default function ProfilePage() {
  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#8B0029] mb-2">마이페이지</h1>
      </div>

      <ProfileForm />
    </div>
  )
}
