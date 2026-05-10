'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { HousingType } from '@/types/recommend'
import { getCurrentSemester } from '@/lib/recommend/semesterUtils'
import { fetchMatchingTemplate, buildPackageResult } from '@/lib/recommend/packageQueries'
import { HousingTypeSelector } from './HousingTypeSelector'
import { PackageResult } from './PackageResult'

interface Props {
  majorId: number | null
  grade: number | null
}

export function PackageRecommendationClient({ majorId, grade }: Props) {
  const [housingType, setHousingType] = useState<HousingType | null>(null)
  const supabase = createClient()
  const semester = getCurrentSemester()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['package-recommendation', majorId, grade, housingType, semester],
    enabled: housingType !== null,
    queryFn: async () => {
      const template = await fetchMatchingTemplate(supabase, {
        major_id: majorId,
        grade,
        housing_type: housingType!,
        semester,
      })
      if (!template) return null

      const categories = await buildPackageResult(supabase, template.package_template_id)
      return { template, categories }
    },
  })

  return (
    <div className="space-y-6">
      <HousingTypeSelector value={housingType} onChange={setHousingType} />

      {housingType === null && (
        <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          거주 형태를 선택하면 추천 패키지를 볼 수 있어요.
        </p>
      )}

      {housingType !== null && isLoading && (
        <div className="py-12 text-center text-sm text-gray-400">
          패키지를 불러오는 중...
        </div>
      )}

      {housingType !== null && isError && (
        <div className="py-12 text-center text-sm text-red-400">
          데이터를 불러오지 못했어요. 다시 시도해주세요.
        </div>
      )}

      {housingType !== null && !isLoading && data === null && (
        <div className="rounded-lg bg-gray-100 px-4 py-8 text-center text-sm text-gray-500">
          조건에 맞는 패키지가 아직 없어요.
        </div>
      )}

      {data && <PackageResult template={data.template} categories={data.categories} />}
    </div>
  )
}
