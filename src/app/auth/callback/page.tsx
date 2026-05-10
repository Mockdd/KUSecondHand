'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { takePendingEmailOtpNext } from '@/lib/auth/otp-session-redirect'
import { safeInternalNavigatePath } from '@/lib/safe-redirect-path'
import { createAuthCallbackSupabaseClient } from '@/lib/supabase/auth-callback-client'

/** PKCE · implicit 리다이렉트 처리 */
function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [hint, setHint] = useState('인증 처리 중…')

  useEffect(() => {
    const run = async () => {
      let nextTarget =
        safeInternalNavigatePath(searchParams.get('next')) ??
        safeInternalNavigatePath(searchParams.get('redirect_to'))

      const supabase = createAuthCallbackSupabaseClient()

      /* implicit hash 처리 전에 레이아웃 한 틱 양보 (일부 브라우저) */
      await new Promise<void>((resolve) =>
        typeof requestAnimationFrame !== 'undefined'
          ? requestAnimationFrame(() => resolve())
          : setTimeout(resolve, 0),
      )

      const code = searchParams.get('code')

      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeErr) {
          console.warn('[auth/callback] exchangeCodeForSession', exchangeErr.message)
        }
      }

      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession()

      if (sessionErr && !session) {
        setHint(sessionErr.message)
        router.replace(`/login?error=${encodeURIComponent(sessionErr.message)}`)
        return
      }

      if (!session?.user) {
        const oauthErr =
          searchParams.get('error_description') ?? searchParams.get('error')
        let msg =
          oauthErr ??
          '링크가 만료되었거나 이미 사용되었습니다. 메일 본문의 6자리 인증번호를 입력해서 진행해 주세요.'
        if (typeof window !== 'undefined') {
          const h = window.location.hash
          if (h.includes('error_code') || h.includes('error_description')) {
            try {
              const hp = new URLSearchParams(h.replace(/^#/, ''))
              msg = hp.get('error_description') ?? hp.get('error') ?? msg
            } catch {
              /* noop */
            }
          }
        }
        setHint(msg)
        router.replace(`/login?error=${encodeURIComponent(msg)}`)
        return
      }

      if (!nextTarget) {
        nextTarget =
          safeInternalNavigatePath(takePendingEmailOtpNext()) ??
          '/products'
      }

      router.replace(nextTarget)
      router.refresh()
    }

    void run()
  }, [router, searchParams])

  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-gray-50 px-4">
      <p className="text-sm text-gray-600">{hint}</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-gray-50 px-4">
          <p className="text-sm text-gray-600">인증 처리 중…</p>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  )
}
