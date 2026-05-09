// 임시 검증 페이지 — 검증 끝나면 삭제. 운영 배포 X.

import { redirect } from 'next/navigation'
import { createClient } from '@lib/supabase/server'
import { listMajorsGroupedByCollege } from '@lib/queries/majors'
import {
  searchCoursesByMajor,
  searchCoursesByKeyword,
} from '@lib/queries/courses'
import type { CourseSearchResult } from '@lib/queries/types'
import type { MajorOption } from '@lib/queries/types'
import UserCoursesVerification from './_components/UserCoursesVerification'

export const dynamic = 'force-dynamic'

type CaseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

async function runCase<T>(fn: () => Promise<T>): Promise<CaseResult<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

type BasicMajorRow = { major_id: number; name: string; college: string | null }

export default async function SupabaseCheckPage() {
  const supabase = await createClient()

  // ─── 인증 가드 — me 페이지와 동일 패턴 ──────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/dev/login')
  }

  // ─── 기존: 직접 SELECT 로 기본 연결 확인 ─────────────────────────
  const basicCheck = await supabase
    .from('majors')
    .select('major_id, name, college')
    .order('major_id', { ascending: true })
    .limit(5)
    .returns<BasicMajorRow[]>()

  // ─── 신규: 수강/추천 검증 — STAT201, STAT301 course_id 동적 조회 ─
  const verificationLookup = await runCase(async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('course_code, course_id')
      .in('course_code', ['STAT201', 'STAT301'])
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as { course_code: string; course_id: number }[]
    const stat201 = rows.find((r) => r.course_code === 'STAT201')?.course_id
    const stat301 = rows.find((r) => r.course_code === 'STAT301')?.course_id
    if (!stat201) throw new Error('courses 시드에 STAT201 없음')
    if (!stat301) throw new Error('courses 시드에 STAT301 없음')
    return { stat201, stat301 }
  })

  // ─── 신규: 쿼리 함수 검증을 위한 통계학과 major_id 동적 조회 ──────
  const statisticsLookup = await runCase(async () => {
    const { data, error } = await supabase
      .from('majors')
      .select('major_id')
      .eq('name', '통계학과')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('majors 에 "통계학과" 행 없음')
    return (data as { major_id: number }).major_id
  })

  // ─── 4개 케이스 병렬 실행 ───────────────────────────────────────
  const [caseGrouped, caseKeyword, caseEmptyKeyword] = await Promise.all([
    runCase(() => listMajorsGroupedByCollege()),
    runCase(() => searchCoursesByKeyword('통계', 'name')),
    runCase(() => searchCoursesByKeyword('', 'name')),
  ])

  const caseByMajor: CaseResult<CourseSearchResult[]> = statisticsLookup.ok
    ? await runCase(() =>
        searchCoursesByMajor(statisticsLookup.value, undefined),
      )
    : {
        ok: false,
        error: `통계학과 major_id 조회 실패: ${statisticsLookup.error}`,
      }

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-8">
      <h1 className="text-2xl font-bold">Supabase 연결/쿼리 검증</h1>

      {/* ─── 섹션 1: 기존 직접 SELECT ─────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">기본 연결 확인</h2>
        {basicCheck.error ? (
          <ErrorBox
            title="❌ 연결 실패"
            entries={{
              code: basicCheck.error.code ?? '(none)',
              message: basicCheck.error.message,
              details: basicCheck.error.details ?? '(none)',
            }}
          />
        ) : (
          <div className="rounded border border-green-300 bg-green-50 p-3 text-sm">
            ✅ 연결 OK · majors 행 {basicCheck.data?.length ?? 0}개 조회
          </div>
        )}
      </section>

      {/* ─── 섹션 2: 쿼리 함수 검증 ───────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">쿼리 함수 검증</h2>
        <div className="space-y-4">
          <CaseGroupedCard result={caseGrouped} />
          <CaseByMajorCard result={caseByMajor} majorId={statisticsLookup} />
          <CaseKeywordCard result={caseKeyword} />
          <CaseEmptyKeywordCard result={caseEmptyKeyword} />
        </div>
      </section>

      {/* ─── 섹션 3: 수강/추천 검증 (Client Component) ─────────────── */}
      {verificationLookup.ok ? (
        <UserCoursesVerification
          stat201CourseId={verificationLookup.value.stat201}
          stat301CourseId={verificationLookup.value.stat301}
        />
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-semibold">수강/추천 검증</h2>
          <ErrorBox
            title="❌ 검증 준비 실패 (STAT201/STAT301 course_id 조회)"
            entries={{ message: verificationLookup.error }}
          />
        </section>
      )}
    </main>
  )
}

// ──────────────────────────────────────────────────────────────────
// 케이스별 카드 컴포넌트
// ──────────────────────────────────────────────────────────────────

function CaseCardShell({
  title,
  call,
  children,
}: {
  title: string
  call: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded border p-4">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="mb-3 font-mono text-xs text-gray-500">{call}</div>
      {children}
    </div>
  )
}

function ErrorBox({
  title,
  entries,
}: {
  title: string
  entries: Record<string, string>
}) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-3 text-sm">
      <div className="mb-2 font-semibold text-red-700">{title}</div>
      <dl className="space-y-1">
        {Object.entries(entries).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[5rem_1fr] gap-2">
            <dt className="text-xs font-medium text-gray-600">{k}</dt>
            <dd className="font-mono text-xs whitespace-pre-wrap">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function CaseGroupedCard({
  result,
}: {
  result: CaseResult<Record<string, MajorOption[]>>
}) {
  return (
    <CaseCardShell title="① listMajorsGroupedByCollege()" call="()">
      {result.ok ? (() => {
        const groups = result.value
        const keys = Object.keys(groups)
        const hasFallback = '기타' in groups
        return (
          <div className="space-y-2 text-sm">
            <div>
              그룹 개수: <span className="font-mono">{keys.length}</span>
            </div>
            <div>
              "기타" 그룹:{' '}
              {hasFallback ? (
                <span className="font-mono text-amber-700">
                  있음 ({groups['기타']?.length ?? 0}개)
                </span>
              ) : (
                <span className="font-mono text-gray-500">없음</span>
              )}
            </div>
            <ul className="mt-2 divide-y rounded border">
              {keys.map((k) => (
                <li
                  key={k}
                  className="flex justify-between px-3 py-1.5 text-xs"
                >
                  <span>{k}</span>
                  <span className="font-mono text-gray-500">
                    {groups[k].length}개
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })() : (
        <ErrorBox title="❌ 호출 실패" entries={{ message: result.error }} />
      )}
    </CaseCardShell>
  )
}

function CaseByMajorCard({
  result,
  majorId,
}: {
  result: CaseResult<CourseSearchResult[]>
  majorId: CaseResult<number>
}) {
  const callLabel = majorId.ok
    ? `(major_id=${majorId.value} /* 통계학과 */, undefined)`
    : '(통계학과 major_id 조회 실패 — 본 호출 스킵)'

  return (
    <CaseCardShell
      title="② searchCoursesByMajor(통계학과, undefined)"
      call={callLabel}
    >
      {result.ok ? (
        <div className="space-y-2 text-sm">
          <div>
            결과 개수: <span className="font-mono">{result.value.length}</span>
          </div>
          {result.value.length === 0 ? (
            <div className="text-xs text-gray-500">
              (course_recommendations 시드 또는 통계학과 과목 시드가 비어 있을 수
              있음)
            </div>
          ) : (
            <ul className="divide-y rounded border">
              {result.value.slice(0, 3).map((c) => (
                <li
                  key={c.course_id}
                  className="flex justify-between px-3 py-1.5 text-xs"
                >
                  <span>
                    {c.course_code} · {c.name}
                  </span>
                  <span className="font-mono text-gray-500">
                    schedules {c.schedules.length}개
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ErrorBox title="❌ 호출 실패" entries={{ message: result.error }} />
      )}
    </CaseCardShell>
  )
}

function CaseKeywordCard({
  result,
}: {
  result: CaseResult<CourseSearchResult[]>
}) {
  return (
    <CaseCardShell
      title="③ searchCoursesByKeyword('통계', 'name')"
      call="('통계', 'name')"
    >
      {result.ok ? (
        <div className="space-y-2 text-sm">
          <div>
            매칭 개수:{' '}
            <span className="font-mono">{result.value.length}</span>
          </div>
          {result.value[0] ? (
            <div className="rounded border px-3 py-1.5 text-xs">
              첫 결과: <span className="font-mono">{result.value[0].course_code}</span>{' '}
              · {result.value[0].name}
            </div>
          ) : (
            <div className="text-xs text-gray-500">매칭 0건</div>
          )}
        </div>
      ) : (
        <ErrorBox title="❌ 호출 실패" entries={{ message: result.error }} />
      )}
    </CaseCardShell>
  )
}

function CaseEmptyKeywordCard({
  result,
}: {
  result: CaseResult<CourseSearchResult[]>
}) {
  return (
    <CaseCardShell
      title="④ searchCoursesByKeyword('', 'name') — 가드 검증"
      call="('', 'name')"
    >
      {result.ok ? (
        result.value.length === 0 ? (
          <div className="text-sm font-medium text-green-700">
            ✅ 빈 배열 반환됨 (DB 호출 X)
          </div>
        ) : (
          <div className="text-sm font-medium text-red-700">
            ❌ 가드 실패: {result.value.length}개 반환
          </div>
        )
      ) : (
        <ErrorBox title="❌ 호출 실패" entries={{ message: result.error }} />
      )}
    </CaseCardShell>
  )
}
