import { NextRequest, NextResponse } from 'next/server'



import { isAllowedSchoolEmail } from '@/constants/schoolDomains'

import { createOtpEmailClient } from '@/lib/supabase/otp-sender'



type Body = {

  email?: string

  /** signup: 새 사용자 허용 / signin_existing: 없는 메일 실패(Find-ID·휴면 등) */

  mode?: 'signup' | 'signin_existing'

  /** 레거시: 본 라우트는 OTP 전용이라 사용하지 않음 (클라이언트가 경로 저장·이동 처리) */

  next?: string | null

}



/**

 * 이메일 OTP 발송 (앱에서는 `verifyOtp` + `type: 'email'` 로 확인).

 *

 * ⚠️ `emailRedirectTo` 를 넣지 않습니다. 들어가면 메일 안에 “우리 서비스로 돌아오는 매직링크”가 커져

 * 회원 입장에서는 “링크 회원가입”처럼 보일 수 있습니다.

 *

 * Supabase Dashboard → Authentication → Email templates → **Magic Link** (OTP 메일)

 * - **제목(Subject):** 예) `KUSecondHand 인증번호입니다` — 기본 "Your Magic Link" 대신 여기서 수정

 * - **본문:** 반드시 `{{ .Token }}` (인증번호 길이는 프로젝트 설정에 따라 6·8자리 등일 수 있음)

 * - **링크 제거:** `{{ .ConfirmationURL }}` 는 빼면 숫자 인증만 안내할 수 있음

 */

export async function POST(request: NextRequest) {

  let body: Body

  try {

    body = await request.json()

  } catch {

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })

  }



  const email = body.email?.trim().toLowerCase()

  const mode = body.mode ?? 'signup'



  if (!email) {

    return NextResponse.json({ error: '이메일을 입력하세요.' }, { status: 400 })

  }

  if (!isAllowedSchoolEmail(email)) {

    return NextResponse.json(

      { error: '고려대학교 메일(@korea.ac.kr)만 이용할 수 있습니다.' },

      { status: 400 },

    )

  }



  try {

    const supabase = createOtpEmailClient()

    const { error } = await supabase.auth.signInWithOtp({

      email,

      options: {

        shouldCreateUser: mode === 'signup',

      },

    })



    if (error) {

      let msg = error.message
      const msgLower = msg.toLowerCase()

      if (
        msgLower.includes('rate limit') ||
        msgLower.includes('too many') ||
        msgLower.includes('over_email_send_rate_limit')
      ) {
        return NextResponse.json(
          {
            error:
              '짧은 시간에 인증 메일을 여러 번 보내 요청 한도에 걸렸습니다. 수십 분 뒤에 다시 시도해 주세요. (Supabase 무료 플랜은 시간당 발송 제한이 작습니다. 대시보드에서 커스텀 SMTP를 쓰면 한도가 달라질 수 있습니다.)',
          },
          { status: 429 },
        )
      }

      if (mode === 'signin_existing') {

        if (

          msg.toLowerCase().includes('signup') ||

          msg.toLowerCase().includes('sign up') ||

          msg.toLowerCase().includes('not found')

        ) {

          msg = '해당 메일로 가입된 계정이 없거나 인증을 보낼 수 없습니다.'

        }

      }

      return NextResponse.json({ error: msg }, { status: 400 })

    }



    return NextResponse.json({ ok: true })

  } catch (e) {

    return NextResponse.json(

      { error: e instanceof Error ? e.message : 'OTP 발송에 실패했습니다.' },

      { status: 500 },

    )

  }

}


