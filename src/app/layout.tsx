import './globals.css'
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <title>KU 교환학생 중고거래</title>
        <meta name="description" content="고려대학교 교환학생 특화 중고거래 플랫폼" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-100 text-gray-900 antialiased">
        <div className="mx-auto max-w-[390px] min-h-screen bg-white relative shadow-xl">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  )
}
