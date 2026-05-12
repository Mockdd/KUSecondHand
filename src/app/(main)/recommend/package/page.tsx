import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PackageRecommendationClient } from './_components/PackageRecommendationClient'

export default async function PackageRecommendPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/recommend/package')

  const { data: profile } = await supabase
    .from('users')
    .select('major_id, grade')
    .eq('uid', user.id)
    .single()

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">내 학기 패키지 추천</h1>
      <p className="mb-6 text-sm text-gray-500">
        학과·학년·거주 형태를 기반으로 필요한 물품을 한눈에 볼 수 있어요.
      </p>
      <PackageRecommendationClient
        majorId={profile?.major_id ?? null}
        grade={profile?.grade ?? null}
      />
    </div>
  )
}
