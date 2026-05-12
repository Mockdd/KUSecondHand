import Link from 'next/link'

export function RecommendBanner() {
  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-gray-900">추천 기능</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Package recommendation */}
        <Link
          href="/recommend/package"
          className="group relative overflow-hidden rounded-2xl p-6 transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #8B0029 0%, #6B0020 100%)' }}
        >
          <div className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full bg-white opacity-10" />
          <div className="relative">
            <h3 className="text-xl font-bold text-white">패키지 추천</h3>
            <p className="mt-1 text-sm text-white/75">
              신입생·전과생을 위한<br />
              맞춤형 물품 묶음 추천
            </p>
            <p className="mt-4 text-xs font-semibold text-white/60 group-hover:text-white/90 transition-colors">
              추천받기 →
            </p>
          </div>
        </Link>

        {/* Resale price recommendation */}
        <Link
          href="/recommend/resale-price"
          className="group relative overflow-hidden rounded-2xl p-6 transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)' }}
        >
          <div className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full bg-white opacity-10" />
          <div className="relative">
            <h3 className="text-xl font-bold text-white">시세 추천</h3>
            <p className="mt-1 text-sm text-white/75">
              카테고리·상태·사용 기간 기반<br />
              적정 재판매 가격 계산
            </p>
            <p className="mt-4 text-xs font-semibold text-white/60 group-hover:text-white/90 transition-colors">
              가격 계산하기 →
            </p>
          </div>
        </Link>
      </div>
    </section>
  )
}
