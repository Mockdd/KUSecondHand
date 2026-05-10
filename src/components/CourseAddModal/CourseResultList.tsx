'use client'

import type { CourseSearchResult } from '@lib/queries/types'
import { CATEGORY_KO, formatSchedules } from '@lib/format'

interface FlashMsg {
  courseId: number
  kind: 'success' | 'error'
  text: string
}

interface Props {
  results: CourseSearchResult[]
  onSelect: (course: CourseSearchResult) => void
  addingCourseId: number | null
  flashMsg: FlashMsg | null
  loading: boolean
  /** 검색을 아직 시도하지 않은 상태에서 보여줄 안내 (입력 전 / 학년 미선택 등). */
  emptyHint: string
  /** 검색은 시도했으나 결과가 0건일 때 보여줄 안내. */
  emptyResult: string
  /**
   * 사용자가 검색 액션을 트리거한 적이 있는지.
   * false 면 emptyHint, true 면 emptyResult 표시.
   */
  hasQueried: boolean
}

function formatMeta(course: CourseSearchResult): string {
  const cat = CATEGORY_KO[course.category_type] ?? course.category_type
  const credit = course.credit != null ? `${course.credit}학점` : '학점 미정'
  return `${cat} · ${credit} · ${course.course_code}`
}

export default function CourseResultList({
  results,
  onSelect,
  addingCourseId,
  flashMsg,
  loading,
  emptyHint,
  emptyResult,
  hasQueried,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      {flashMsg && (
        <div
          role="status"
          className={`mx-4 mt-3 text-sm rounded p-2 ${
            flashMsg.kind === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {flashMsg.text}
        </div>
      )}

      {loading ? (
        <p className="p-4 text-sm text-gray-500">검색 중...</p>
      ) : !hasQueried ? (
        <p className="p-4 text-sm text-gray-500">{emptyHint}</p>
      ) : results.length === 0 ? (
        <p className="p-4 text-sm text-gray-500">{emptyResult}</p>
      ) : (
        <ul>
          {results.map((c) => {
            const isAdding = addingCourseId === c.course_id
            return (
              <li
                key={c.course_id}
                className={`border-t first:border-t-0 ${
                  isAdding ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  disabled={isAdding}
                  className="w-full text-left p-3 hover:bg-gray-50"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-gray-600">
                    {c.professor ?? '교수 미정'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatSchedules(c.schedules)}
                  </div>
                  <div className="text-xs text-gray-500">{formatMeta(c)}</div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
