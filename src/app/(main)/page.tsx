import { Suspense } from 'react'
import { HeroSection } from '@/components/home/HeroSection'
import { QuickActionGrid } from '@/components/home/QuickActionGrid'
import { RecentProducts } from '@/components/home/RecentProducts'
import { RecommendBanner } from '@/components/home/RecommendBanner'

export default function HomePage() {
  return (
    <div className="-mx-4 -my-6">
      <HeroSection />
      <div className="space-y-10 px-4 py-10">
        <QuickActionGrid />
        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-gray-100" />}>
          <RecentProducts />
        </Suspense>
        <RecommendBanner />
      </div>
    </div>
  )
}
