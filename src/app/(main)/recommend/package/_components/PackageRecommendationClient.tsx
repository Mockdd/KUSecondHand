'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { HousingType, PackageTemplate } from '@/types/recommend'
import { getCurrentSemester } from '@/lib/recommend/semesterUtils'
import {
  fetchMatchingTemplate,
  buildPackageResult,
  fetchEssentialPackageByType,
  buildEssentialPackageCategories,
  EssentialPackageType,
} from '@/lib/recommend/packageQueries'
import { HousingTypeSelector } from './HousingTypeSelector'
import { PackageResult } from './PackageResult'

interface Props {
  majorId: number | null
  grade: number | null
  essentialType?: EssentialPackageType | null
}

const ESSENTIAL_HOUSING: Record<EssentialPackageType, HousingType> = {
  DORM_BASIC: 'dorm',
  FLAT_FULL: 'flat',
}

export function PackageRecommendationClient({ majorId, grade, essentialType = null }: Props) {
  const supabase = createClient()

  if (essentialType !== null) {
    return <EssentialPackageView supabase={supabase} essentialType={essentialType} />
  }

  return <TemplateMatchView supabase={supabase} majorId={majorId} grade={grade} />
}

// ─── 기존 흐름: 학과/학년/거주 매칭 템플릿 ────────────────────────────────────────

function TemplateMatchView({
  supabase,
  majorId,
  grade,
}: {
  supabase: ReturnType<typeof createClient>
  majorId: number | null
  grade: number | null
}) {
  const [housingType, setHousingType] = useState<HousingType | null>(null)
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

      const categories = await buildPackageResult(supabase, template.package_template_id, majorId)
      return { template, categories }
    },
  })

  return (
    <div className="space-y-6">
      <HousingTypeSelector value={housingType} onChange={setHousingType} />

      {housingType === null && (
        <p className="rounded-lg bg-[#FDF2F4] px-4 py-3 text-sm text-[#8B0029]">
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

// ─── 새 흐름: essential_packages (메인 카드 진입) ────────────────────────────────

function EssentialPackageView({
  supabase,
  essentialType,
}: {
  supabase: ReturnType<typeof createClient>
  essentialType: EssentialPackageType
}) {
  const housingType = ESSENTIAL_HOUSING[essentialType]

  const { data, isLoading, isError } = useQuery({
    queryKey: ['essential-package', essentialType],
    queryFn: async () => {
      const pkg = await fetchEssentialPackageByType(supabase, essentialType)
      if (!pkg) return null

      const categories = await buildEssentialPackageCategories(supabase, pkg.package_id, null)

      const template: PackageTemplate = {
        package_template_id: pkg.package_id,
        title: pkg.name_ko,
        description: pkg.name_en,
        major_id: null,
        grade: null,
        housing_type: housingType,
        semester: null,
      }
      return { template, categories }
    },
  })

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="py-12 text-center text-sm text-gray-400">
          패키지를 불러오는 중...
        </div>
      )}

      {isError && (
        <div className="py-12 text-center text-sm text-red-400">
          데이터를 불러오지 못했어요. 다시 시도해주세요.
        </div>
      )}

      {!isLoading && data === null && (
        <div className="rounded-lg bg-gray-100 px-4 py-8 text-center text-sm text-gray-500">
          패키지 정보를 찾을 수 없어요.
        </div>
      )}

      {data && <PackageResult template={data.template} categories={data.categories} />}
    </div>
  )
}
