import { redirect } from 'next/navigation'
import { createClient } from '@lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DevMePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/dev/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('uid', user.id)
    .maybeSingle()

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-lg font-semibold">Dev — 현재 사용자</h1>
      <p className="text-xs text-gray-500">
        옆 팀의 정식 인증 UI 가 완성되면 삭제될 임시 페이지.
      </p>

      <section className="space-y-1">
        <h2 className="text-sm font-medium">auth.users</h2>
        <dl className="text-sm border rounded p-3 space-y-1">
          <div className="flex gap-2">
            <dt className="text-gray-500 w-16">id</dt>
            <dd className="font-mono break-all">{user.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500 w-16">email</dt>
            <dd className="break-all">{user.email}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-medium">public.users 프로필</h2>
        {profile ? (
          <pre className="text-xs border rounded p-3 overflow-x-auto">
            {JSON.stringify(profile, null, 2)}
          </pre>
        ) : (
          <div className="text-sm border border-yellow-400 bg-yellow-50 text-yellow-900 rounded p-3">
            프로필 자동 생성 트리거 미작동.
            <br />
            <code className="text-xs">supabase/migrations</code> 의 트리거(
            auth.users → public.users)를 확인하세요.
            {profileError && (
              <div className="mt-1 text-xs text-yellow-800">
                조회 에러: {profileError.message}
              </div>
            )}
          </div>
        )}
      </section>

      <form action="/dev/logout" method="post">
        <button
          type="submit"
          className="border rounded px-3 py-1 text-sm"
        >
          로그아웃
        </button>
      </form>
    </div>
  )
}
