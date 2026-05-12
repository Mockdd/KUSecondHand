import Link from 'next/link'
import { NavBar } from '@/components/layout/NavBar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="font-semibold text-gray-900 hover:text-indigo-600">
            KU Secondhand
          </Link>
          <NavBar />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
