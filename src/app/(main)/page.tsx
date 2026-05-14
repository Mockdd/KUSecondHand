import { Suspense } from 'react'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { PopularProducts } from '@/components/home/PopularProducts'
import { FeaturedPackages } from '@/components/home/FeaturedPackages'

export default function HomePage() {
  return (
    <div className="-mx-4 -my-6">
      {/* Full-bleed carousel */}
      <HeroCarousel />

      {/* Content sections */}
      <div className="space-y-12 px-4 py-12">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-gray-100" />}>
          <PopularProducts />
        </Suspense>

        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-gray-100" />}>
          <FeaturedPackages />
        </Suspense>
      </div>
    </div>
  )
}
