import Image from 'next/image'
import Link from 'next/link'

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden px-6 py-14 sm:py-20"
      style={{ background: 'linear-gradient(135deg, #8B0029 0%, #5C0019 100%)' }}
    >
      {/* Decorative circles */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white opacity-[0.07]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white opacity-[0.07]"
        aria-hidden
      />

      <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-10">
        {/* Copy */}
        <div className="flex-1 text-white">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            Korea University
          </p>
          <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl">
            고려대 학우들의<br />
            안전한 중고거래
          </h1>
          <p className="mb-8 max-w-sm text-sm leading-relaxed text-white/75">
            학교 공식 이메일로 인증된 학우들끼리<br />
            신뢰할 수 있는 직거래를 시작하세요.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#8B0029] transition-opacity hover:opacity-90"
            >
              상품 둘러보기
            </Link>
            <Link
              href="/products/new"
              className="rounded-full border border-white/60 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              상품 등록
            </Link>
          </div>
        </div>

        {/* Emblem */}
        <div className="hidden flex-shrink-0 sm:block">
          <Image
            src="/emblem_ku.png"
            alt="고려대학교 엠블럼"
            width={160}
            height={160}
            priority
            className="opacity-90 drop-shadow-xl"
          />
        </div>
      </div>
    </section>
  )
}
