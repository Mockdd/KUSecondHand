import Link from 'next/link'
import Image from 'next/image'
import { NavBar } from '@/components/layout/NavBar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/emblem_ku.png"
              alt="고려대학교"
              width={28}
              height={28}
              className="opacity-90"
            />
            <span className="font-bold text-[#8B0029] text-base tracking-tight">
              KU Secondhand
            </span>
          </Link>
          <NavBar />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
