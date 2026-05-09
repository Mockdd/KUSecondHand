'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@lib/supabase/client'
import { getMyCourses } from '@lib/queries/user-courses'
import { getMyRecommendations } from '@lib/queries/recommendations'
import type { MyCourseEntry, RecommendationGroup } from '@lib/queries/types'
import {
  formatCoursesSummary,
  formatRecommendationReason,
} from '@lib/format'

const SEMESTER = '2026-1'

export default function RecommendationResultPage() {
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [courses, setCourses] = useState<MyCourseEntry[]>([])
  const [groups, setGroups] = useState<RecommendationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

      try {
        const [myCourses, myGroups] = await Promise.all([
          getMyCourses(SEMESTER),
          getMyRecommendations(SEMESTER),
        ])
        if (cancelled) return
        setCourses(myCourses)
        setGroups(myGroups)
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof Error ? e.message : '추천 결과를 불러오지 못했습니다.',
        )
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!authChecked || loading) {
    return (
      <div className="max-w-md mx-auto p-4">
        <p className="text-sm text-gray-500">추천 결과 불러오는 중...</p>
      </div>
    )
  }

  const courseNames = courses.map((c) => c.name)
  const subtitle = formatCoursesSummary(courseNames)

  let title: string
  if (courses.length === 0) {
    title = '추천 받을 과목이 없어요'
  } else if (groups.length === 0) {
    title = '추천 물품을 준비 중이에요'
  } else {
    title = '이 물품들이 필요할 거 같아요'
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <Link
        href="/recommendations"
        className="inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← 과목 다시 선택하기
      </Link>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-gray-600">{subtitle}</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
          <p className="mt-1 text-xs text-red-600">
            잠시 후 페이지를 새로고침해 주세요.
          </p>
        </div>
      )}

      {!error && courses.length > 0 && groups.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            이 과목들에 대한 추천 물품을 준비 중이에요.
          </p>
          <Link
            href="/recommendations"
            className="inline-block border rounded px-3 py-1 text-sm"
          >
            돌아가기
          </Link>
        </div>
      )}

      {!error && groups.length > 0 && (
        <ul>
          {groups.map((g) => {
            const firstCourseName = g.matched_course_names[0] ?? ''
            const reason = formatRecommendationReason(
              g.reason_template,
              firstCourseName,
            )
            return (
              <li
                key={g.item_category_id}
                className="border-t py-4 space-y-2 first:border-t-0 first:pt-0"
              >
                <h3 className="text-base font-semibold">
                  {g.item_category_name}
                </h3>
                <p className="text-xs text-gray-500">
                  관련 과목 : {g.matched_course_names.join(', ')}
                </p>
                <p className="text-sm text-gray-700">추천 이유: {reason}</p>
                {g.category_id !== null ? (
                  <Link
                    href={`/products?category=${g.category_id}`}
                    className="inline-block bg-black text-white text-sm rounded px-3 py-1.5"
                  >
                    상품 보러가기
                  </Link>
                ) : (
                  <div className="space-y-1">
                    <button
                      type="button"
                      disabled
                      className="inline-block bg-gray-200 text-gray-400 text-sm rounded px-3 py-1.5 cursor-not-allowed"
                    >
                      상품 보러가기
                    </button>
                    <p className="text-xs text-gray-400">
                      매물 카테고리 매핑 미설정
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
