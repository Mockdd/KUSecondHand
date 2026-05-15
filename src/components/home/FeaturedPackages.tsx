import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type Package = {
  package_id: number
  template_type: string
  name_ko: string
  name_en: string
  housing_type: string | null
}

const PACKAGE_ICONS: Record<string, string> = {
  DORM_BASIC:     '🏠',
  FLAT_FULL:      '🏢',
}

const PACKAGE_DESC: Record<string, string> = {
  DORM_BASIC:     '기숙사 생활에 필요한 기본 패키지',
  FLAT_FULL:      '하숙·원룸 생활 완전 구비 패키지',
}

export async function FeaturedPackages() {
  const supabase = await createClient()
  const { data: packages } = await supabase
    .from('essential_packages')
    .select('package_id, template_type, name_ko, name_en, housing_type')
    .in('template_type', ['DORM_BASIC', 'FLAT_FULL'])
    .order('package_id')

  if (!packages || packages.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">추천 패키지</h2>
          <p className="text-xs text-gray-400 mt-0.5">상황에 맞는 패키지를 한 번에</p>
        </div>
        <Link href="/recommend/package" className="text-sm text-[#8B0029] font-medium hover:underline">
          전체보기 →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(packages as Package[]).map((pkg) => (
          <Link
            key={pkg.package_id}
            href="/recommend/package"
            className="group flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-[#8B0029]/30 transition-all"
          >
            <span className="text-3xl">{PACKAGE_ICONS[pkg.template_type] ?? '📦'}</span>
            <div>
              <p className="font-bold text-gray-900 group-hover:text-[#8B0029] transition-colors">
                {pkg.name_ko}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{pkg.name_en}</p>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              {PACKAGE_DESC[pkg.template_type] ?? '패키지 상품 추천'}
            </p>
            <span className="mt-auto text-xs font-semibold text-[#8B0029] group-hover:underline">
              추천받기 →
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
