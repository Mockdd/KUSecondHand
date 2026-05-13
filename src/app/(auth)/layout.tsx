export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#8B0029]/[0.07] to-gray-50 px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
