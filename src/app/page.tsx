import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">KU Secondhand</h1>
      <div className="flex gap-4 text-sm">
        <Link href="/recommend/package" className="text-blue-600 hover:underline">
          패키지 추천
        </Link>
        <Link href="/recommend/resale-price" className="text-blue-600 hover:underline">
          재판매 가격 추천
        </Link>
      </div>
    </main>
  )
}
