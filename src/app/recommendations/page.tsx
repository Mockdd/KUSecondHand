'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@lib/supabase/client'
import { getMyCourses, removeUserCourse } from '@lib/queries/user-courses'
import type { MyCourseEntry } from '@lib/queries/types'
import CourseAddModal from '@components/CourseAddModal'

const SEMESTER = '2026-1'

export default function RecommendationsPage() {
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [courses, setCourses] = useState<MyCourseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  async function loadCourses() {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyCourses(SEMESTER)
      setCourses(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '과목 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        router.replace('/dev/login')
        return
      }
      setAuthChecked(true)
      await loadCourses()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRemove(courseId: number) {
    setRemovingId(courseId)
    setError(null)
    try {
      await removeUserCourse(courseId, SEMESTER)
      await loadCourses()
    } catch (e) {
      setError(e instanceof Error ? e.message : '과목 삭제에 실패했습니다.')
    } finally {
      setRemovingId(null)
    }
  }

  function handleAddCourse() {
    setModalOpen(true)
  }

  function handleSubmit() {
    router.push('/recommendations/result')
  }

  if (!authChecked || loading) {
    return (
      <div className="max-w-md mx-auto p-4">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    )
  }

  const canSubmit = courses.length > 0

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">내 시간표 맞춤 추천</h1>
        <p className="text-sm text-gray-600">
          수강 중인 과목을 등록하면 필요한 물품을 추천해드려요.
        </p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">내 수강 과목</h2>
          <button
            type="button"
            onClick={handleAddCourse}
            className="border rounded px-3 py-1 text-sm"
          >
            + 과목 추가하기
          </button>
        </div>

        {courses.length === 0 ? (
          <p className="text-sm text-gray-500">아직 등록된 과목이 없어요.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {courses.map((c) => {
              const isRemoving = removingId === c.course_id
              return (
                <li
                  key={c.course_id}
                  className={`inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm ${
                    isRemoving ? 'opacity-50' : ''
                  }`}
                >
                  <span>{c.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(c.course_id)}
                    disabled={isRemoving}
                    aria-label={`${c.name} 제거`}
                    className="text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full rounded py-2 text-sm font-medium ${
          canSubmit
            ? 'bg-black text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        추천 받기
      </button>

      <CourseAddModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCourseAdded={loadCourses}
      />
    </div>
  )
}
