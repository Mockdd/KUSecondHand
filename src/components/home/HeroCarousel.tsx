'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Decorative SVGs ──────────────────────────────────────────────────────────

function PackageVisual() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden>
      <rect x="30" y="80" width="140" height="100" rx="8" fill="rgba(139,0,41,0.15)" />
      <rect x="40" y="70" width="120" height="20" rx="4" fill="rgba(139,0,41,0.25)" />
      <line x1="100" y1="80" x2="100" y2="180" stroke="rgba(139,0,41,0.3)" strokeWidth="2" />
      <path d="M80 40 Q100 20 120 40 Q130 55 100 65 Q70 55 80 40Z" fill="rgba(139,0,41,0.2)" />
      <circle cx="60" cy="120" r="8" fill="rgba(139,0,41,0.2)" />
      <circle cx="140" cy="120" r="8" fill="rgba(139,0,41,0.2)" />
      <rect x="75" y="105" width="50" height="30" rx="3" fill="rgba(139,0,41,0.15)" />
    </svg>
  )
}

function SellVisual() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden>
      <circle cx="100" cy="90" r="55" fill="rgba(139,0,41,0.12)" />
      <circle cx="100" cy="90" r="38" fill="rgba(139,0,41,0.15)" />
      <path d="M78 90 L95 107 L122 78" stroke="rgba(139,0,41,0.6)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55 155 Q100 135 145 155" stroke="rgba(139,0,41,0.25)" strokeWidth="2" />
      <rect x="70" y="158" width="60" height="8" rx="4" fill="rgba(139,0,41,0.15)" />
    </svg>
  )
}

function PriceVisual() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden>
      <rect x="30" y="150" width="24" height="30" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="64" y="120" width="24" height="60" rx="3" fill="rgba(255,255,255,0.3)" />
      <rect x="98" y="90" width="24" height="90" rx="3" fill="rgba(255,255,255,0.4)" />
      <rect x="132" y="60" width="24" height="120" rx="3" fill="rgba(255,255,255,0.55)" />
      <polyline points="42,148 76,118 110,88 144,58" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="144" cy="58" r="5" fill="white" fillOpacity="0.8" />
    </svg>
  )
}

function GridVisual() {
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden>
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={30 + col * 52}
            y={30 + row * 52}
            width="44"
            height="44"
            rx="6"
            fill="rgba(139,0,41,0.10)"
            stroke="rgba(139,0,41,0.15)"
            strokeWidth="1"
          />
        ))
      )}
      <rect x="30" y="30" width="44" height="44" rx="6" fill="rgba(139,0,41,0.22)" />
      <rect x="82" y="82" width="44" height="44" rx="6" fill="rgba(139,0,41,0.18)" />
    </svg>
  )
}

// ─── Slide definitions ────────────────────────────────────────────────────────

type SlideTheme = 'dark' | 'light'

interface Slide {
  id: number
  href: string
  bg: string
  eyebrow: string
  title: [string, string]
  desc: string
  cta: string
  theme: SlideTheme
  visual: 'emblem' | 'package' | 'grid' | 'sell' | 'price'
}

const SLIDES: Slide[] = [
  {
    id: 0,
    href: '/products',
    bg: 'linear-gradient(135deg, #8B0029 0%, #4A0016 60%, #1E0009 100%)',
    eyebrow: 'KU Secondhand',
    title: ['고려대 학우들의', '안전한 중고거래'],
    desc: '학교 이메일로 인증된 학우들끼리\n신뢰할 수 있는 직거래를 시작하세요',
    cta: '상품 둘러보기',
    theme: 'dark',
    visual: 'emblem',
  },
  {
    id: 1,
    href: '/recommend/package',
    bg: 'linear-gradient(135deg, #FFF5EE 0%, #FFE4D6 50%, #FDDCCC 100%)',
    eyebrow: 'Package Recommendation',
    title: ['교환학생 필수품', '패키지 추천'],
    desc: '기숙사·하숙·홈스테이 유형별로\n필요한 물품을 한 번에 추천해드려요',
    cta: '패키지 추천받기',
    theme: 'light',
    visual: 'package',
  },
  {
    id: 2,
    href: '/packages',
    bg: 'linear-gradient(135deg, #1E0009 0%, #4A0016 60%, #8B0029 100%)',
    eyebrow: 'Marketplace',
    title: ['학우들이 직접 올린', '중고 패키지'],
    desc: '실제 필요한 물건들을 묶어서\n합리적인 가격에 거래하세요',
    cta: '패키지 보러가기',
    theme: 'dark',
    visual: 'grid',
  },
  {
    id: 3,
    href: '/products/new',
    bg: 'linear-gradient(135deg, #F7F0EB 0%, #EDE0D8 60%, #E0CCBF 100%)',
    eyebrow: 'Sell',
    title: ['안 쓰는 물건', '지금 판매하세요'],
    desc: '시세 추천으로 최적 가격을 찾고\n학우들에게 바로 판매할 수 있어요',
    cta: '판매 시작하기',
    theme: 'light',
    visual: 'sell',
  },
  {
    id: 4,
    href: '/recommend/resale-price',
    bg: 'linear-gradient(135deg, #6B0020 0%, #8B0029 40%, #B0003A 100%)',
    eyebrow: 'Price Guide',
    title: ['재판매 가격이', '얼마가 적당할까요?'],
    desc: '상품 상태·카테고리 기반으로\n적정 시세를 바로 알려드려요',
    cta: '가격 추천받기',
    theme: 'dark',
    visual: 'price',
  },
]

// ─── Carousel ─────────────────────────────────────────────────────────────────

export function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goTo = useCallback((idx: number) => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setCurrent(idx)
      setAnimating(false)
    }, 300)
  }, [animating])

  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo])
  const prev = useCallback(() => goTo((current - 1 + SLIDES.length) % SLIDES.length), [current, goTo])

  useEffect(() => {
    if (paused) return
    timerRef.current = setTimeout(next, 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [current, paused, next])

  const slide = SLIDES[current]
  const isDark = slide.theme === 'dark'
  const textMain = isDark ? 'text-white' : 'text-[#1E0009]'
  const textSub = isDark ? 'text-white/65' : 'text-[#8B0029]/70'
  const textEye = isDark ? 'text-white/45' : 'text-[#8B0029]/50'

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: 'clamp(420px, 60vh, 620px)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{ background: slide.bg, opacity: animating ? 0 : 1 }}
      />

      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-[0.06]"
        style={{ backgroundColor: isDark ? 'white' : '#8B0029' }} />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full opacity-[0.06]"
        style={{ backgroundColor: isDark ? 'white' : '#8B0029' }} />

      {/* Content */}
      <div
        className="relative h-full max-w-5xl mx-auto px-8 sm:px-12 flex items-center justify-between gap-8 transition-opacity duration-300"
        style={{ opacity: animating ? 0 : 1 }}
      >
        {/* Text */}
        <div className="flex-1 max-w-xl">
          <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-4 ${textEye}`}>
            {slide.eyebrow}
          </p>
          <h2 className={`text-4xl sm:text-5xl font-bold leading-tight mb-5 ${textMain}`}>
            {slide.title[0]}<br />{slide.title[1]}
          </h2>
          <p className={`text-sm leading-relaxed mb-8 whitespace-pre-line ${textSub}`}>
            {slide.desc}
          </p>
          <Link
            href={slide.href}
            className={`inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-opacity hover:opacity-85 ${
              isDark
                ? 'bg-white text-[#8B0029]'
                : 'bg-[#8B0029] text-white'
            }`}
          >
            {slide.cta}
            <span className="text-base">→</span>
          </Link>
        </div>

        {/* Visual */}
        <div className="hidden sm:flex shrink-0 w-48 h-48 items-center justify-center">
          {slide.visual === 'emblem' && (
            <Image
              src="/emblem_ku.png"
              alt="고려대학교 엠블럼"
              width={180}
              height={180}
              priority
              className={`${isDark ? 'opacity-80' : 'opacity-70'} drop-shadow-xl`}
            />
          )}
          {slide.visual === 'package' && <PackageVisual />}
          {slide.visual === 'grid' && <GridVisual />}
          {slide.visual === 'sell' && <SellVisual />}
          {slide.visual === 'price' && <PriceVisual />}
        </div>
      </div>

      {/* Prev / Next */}
      <button
        onClick={prev}
        aria-label="이전"
        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full transition-colors"
        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(139,0,41,0.12)' }}
      >
        <span className={`text-lg ${isDark ? 'text-white' : 'text-[#8B0029]'}`}>‹</span>
      </button>
      <button
        onClick={next}
        aria-label="다음"
        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full transition-colors"
        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(139,0,41,0.12)' }}
      >
        <span className={`text-lg ${isDark ? 'text-white' : 'text-[#8B0029]'}`}>›</span>
      </button>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            aria-label={`슬라이드 ${i + 1}`}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === current ? 24 : 8,
              height: 8,
              backgroundColor: isDark
                ? i === current ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'
                : i === current ? 'rgba(139,0,41,0.85)' : 'rgba(139,0,41,0.25)',
            }}
          />
        ))}
      </div>

      {/* Progress bar */}
      {!paused && (
        <div className="absolute bottom-0 left-0 h-[2px] w-full overflow-hidden">
          <div
            key={current}
            className="h-full"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(139,0,41,0.4)',
              animation: 'progressBar 5s linear forwards',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes progressBar {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  )
}
