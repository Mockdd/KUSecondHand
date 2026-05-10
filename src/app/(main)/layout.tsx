import Link from 'next/link'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/products" className="font-semibold text-gray-900 hover:text-indigo-600">
            KU Secondhand
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/products" className="text-gray-600 hover:text-indigo-600">
              상품
            </Link>
            <Link href="/my/profile" className="text-gray-600 hover:text-indigo-600">
              내 프로필
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
