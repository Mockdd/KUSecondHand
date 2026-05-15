import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PackageRecommendationClient } from './_components/PackageRecommendationClient'
import type { EssentialPackageType } from '@/lib/recommend/packageQueries'

export const dynamic = 'force-dynamic'

export default async function PackageRecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const essentialType: EssentialPackageType | null =
    type === 'DORM_BASIC' || type === 'FLAT_FULL' ? type : null

  const nextPath = essentialType
    ? `/recommend/package?type=${essentialType}`
    : '/recommend/package'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)

  const { data: profile } = await supabase
    .from('users')
    .select('major_id, grade')
    .eq('uid', user.id)
    .single()

  const heading = essentialType === 'DORM_BASIC'
    ? '기숙사 기본 패키지'
    : essentialType === 'FLAT_FULL'
      ? '자취·하숙 풀 패키지'
      : '내 학기 패키지 추천'

  const subheading = essentialType
    ? '아래 카테고리별로 매물을 한눈에 확인할 수 있어요.'
    : '학과·학년·거주 형태를 기반으로 필요한 물품을 한눈에 볼 수 있어요.'

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">{heading}</h1>
      <p className="mb-6 text-sm text-gray-500">{subheading}</p>
      <PackageRecommendationClient
        majorId={profile?.major_id ?? null}
        grade={profile?.grade ?? null}
        essentialType={essentialType}
      />
    </div>
  )
}
