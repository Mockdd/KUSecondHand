'use client'

// 임시 검증 컴포넌트 — 검증 끝나면 page.tsx 와 함께 삭제. 운영 배포 X.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addUserCourse,
  getMyCourseIds,
  getMyCourses,
  removeUserCourse,
} from '@lib/queries/user-courses'
import { getMyRecommendations } from '@lib/queries/recommendations'
import type {
  MyCourseEntry,
  RecommendationGroup,
} from '@lib/queries/types'

const SEMESTER = '2026-1'

interface Props {
  stat201CourseId: number
  stat301CourseId: number
}

interface SnapshotData {
  myCourses: MyCourseEntry[]
  myCourseIds: number[]
  myRecs: RecommendationGroup[]
}

export default function UserCoursesVerification({
  stat201CourseId,
  stat301CourseId,
}: Props) {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [duplicateCaught, setDuplicateCaught] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setSnapshotError(null)

    Promise.all([
      getMyCourses(SEMESTER),
      getMyCourseIds(SEMESTER),
      getMyRecommendations(SEMESTER),
    ])
      .then(([myCourses, myCourseIds, myRecs]) => {
        if (cancelled) return
        setSnapshot({ myCourses, myCourseIds, myRecs })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setSnapshotError(e instanceof Error ? e.message : String(e))
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  const runAction = async (
    label: string,
    fn: () => Promise<void>,
    opts: { catchDuplicate?: boolean } = {},
  ) => {
    setPendingAction(label)
    setActionMessage(null)
    setActionError(null)

    try {
      await fn()
      setActionMessage(`✅ ${label} 성공`)
      router.refresh() // Server Component 측 데이터(혹시 추가될 경우) 갱신
      refetch()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (opts.catchDuplicate && msg === 'ALREADY_ADDED') {
        setDuplicateCaught(true)
        setActionMessage(`✅ ${label} — ALREADY_ADDED 정상 캐치`)
      } else {
        setActionError(`❌ ${label} 실패: ${msg}`)
      }
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">수강/추천 검증</h2>
      <p className="mb-4 text-xs text-gray-500">
        학기: <span className="font-mono">{SEMESTER}</span> · 통계학개론
        course_id=<span className="font-mono">{stat201CourseId}</span> · 확률론
        course_id=<span className="font-mono">{stat301CourseId}</span>
      </p>

      {/* ─── 액션 버튼 ────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-2">
        <ActionButton
          label="통계학개론 추가"
          pending={pendingAction === '통계학개론 추가'}
          onClick={() =>
            runAction('통계학개론 추가', () =>
              addUserCourse(stat201CourseId, SEMESTER),
            )
          }
        />
        <ActionButton
          label="통계학개론 다시 추가 (중복)"
          pending={pendingAction === '통계학개론 다시 추가 (중복)'}
          onClick={() =>
            runAction(
              '통계학개론 다시 추가 (중복)',
              () => addUserCourse(stat201CourseId, SEMESTER),
              { catchDuplicate: true },
            )
          }
        />
        <ActionButton
          label="확률론 추가"
          pending={pendingAction === '확률론 추가'}
          onClick={() =>
            runAction('확률론 추가', () =>
              addUserCourse(stat301CourseId, SEMESTER),
            )
          }
        />
        <ActionButton
          label="통계학개론 제거"
          pending={pendingAction === '통계학개론 제거'}
          onClick={() =>
            runAction('통계학개론 제거', () =>
              removeUserCourse(stat201CourseId, SEMESTER),
            )
          }
        />
      </div>

      {/* ─── 액션 결과 메시지 ─────────────────────────────────── */}
      {actionMessage && (
        <div className="mb-2 rounded border border-green-300 bg-green-50 p-2 text-xs">
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {actionError}
        </div>
      )}
      {duplicateCaught && (
        <div className="mb-4 rounded border-2 border-red-400 bg-red-50 p-3 text-sm font-medium text-red-700">
          ✅ ALREADY_ADDED 정상 캐치 — 23505 분기 동작 확인
        </div>
      )}

      {/* ─── 현재 상태 ────────────────────────────────────────── */}
      <div className="rounded border p-4">
        <div className="mb-3 text-sm font-semibold">현재 상태</div>
        {snapshotError ? (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            ❌ 조회 실패: {snapshotError}
          </div>
        ) : !snapshot ? (
          <div className="text-xs text-gray-500">로딩…</div>
        ) : (
          <div className="space-y-4">
            <SnapshotMyCourses courses={snapshot.myCourses} />
            <SnapshotIds ids={snapshot.myCourseIds} />
            <SnapshotRecs recs={snapshot.myRecs} />
          </div>
        )}
      </div>
    </section>
  )
}

// ──────────────────────────────────────────────────────────────────

function ActionButton({
  label,
  onClick,
  pending,
}: {
  label: string
  onClick: () => void
  pending: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded border px-3 py-1 text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? `${label}…` : label}
    </button>
  )
}

function SnapshotMyCourses({ courses }: { courses: MyCourseEntry[] }) {
  return (
    <div>
      <div className="mb-1 font-mono text-xs text-gray-500">
        getMyCourses('{SEMESTER}') → {courses.length}건
      </div>
      {courses.length === 0 ? (
        <div className="text-xs text-gray-500">[] (비어있음)</div>
      ) : (
        <ul className="divide-y rounded border">
          {courses.map((c) => (
            <li key={c.course_id} className="px-3 py-1.5 text-xs">
              <div className="flex justify-between">
                <span>
                  <span className="font-mono">{c.course_code}</span> · {c.name}
                </span>
                <span className="font-mono text-gray-500">
                  schedules {c.schedules.length}개
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-gray-400">
                enrolled_at: {c.enrolled_at} · semester: {c.semester}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SnapshotIds({ ids }: { ids: number[] }) {
  return (
    <div>
      <div className="mb-1 font-mono text-xs text-gray-500">
        getMyCourseIds('{SEMESTER}') → {ids.length}건
      </div>
      <div className="rounded border bg-gray-50 px-3 py-1.5 font-mono text-xs">
        [{ids.join(', ')}]
      </div>
    </div>
  )
}

function SnapshotRecs({ recs }: { recs: RecommendationGroup[] }) {
  return (
    <div>
      <div className="mb-1 font-mono text-xs text-gray-500">
        getMyRecommendations('{SEMESTER}') → {recs.length}그룹
      </div>
      {recs.length === 0 ? (
        <div className="text-xs text-gray-500">[] (추천 없음)</div>
      ) : (
        <ul className="space-y-2">
          {recs.map((r) => (
            <li key={r.item_category_id} className="rounded border p-2 text-xs">
              <div className="mb-1 flex justify-between">
                <span className="font-semibold">
                  {r.item_category_name}{' '}
                  <span className="font-mono text-gray-400">
                    ({r.item_category_type})
                  </span>
                </span>
                <span className="font-mono text-gray-500">
                  priority {r.priority}
                </span>
              </div>
              {r.reason_template && (
                <div className="mb-1 text-gray-600">
                  reason_template:{' '}
                  <span className="font-mono">{r.reason_template}</span>
                </div>
              )}
              <div className="font-mono text-[10px] text-gray-500">
                matched_course_ids: [{r.matched_course_ids.join(', ')}]
              </div>
              <div className="font-mono text-[10px] text-gray-500">
                matched_course_names: [{r.matched_course_names.join(', ')}]
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
