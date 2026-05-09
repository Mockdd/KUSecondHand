import { createClient } from '@lib/supabase/client'
import type { RecommendationGroup } from './types'
import { getMyCourseIds } from './user-courses'

const REC_SELECT = `
  course_id,
  item_category_id,
  reason_template,
  priority,
  item_categories (
    name,
    type,
    description,
    category_id
  ),
  courses (
    name
  )
`

interface RecRow {
  course_id: number
  item_category_id: number
  reason_template: string | null
  priority: number
  item_categories: {
    name: string
    type: string
    description: string | null
    category_id: number | null
  } | null
  courses: {
    name: string
  } | null
}

/**
 * 주어진 과목 ID 배열에 대한 추천 카테고리 목록을 조회한다.
 *
 * - 빈 배열이면 즉시 [] 반환 (DB 호출 X)
 * - course_recommendations + item_categories + courses 한 번에 조회 (N+1 방지)
 * - DB 쪽 정렬: priority DESC → item_category_id ASC (그룹 내 첫 진입 행이 최댓값 priority)
 * - 같은 item_category 가 여러 과목에서 매칭되면 JS 에서 그룹화:
 *   priority = max, matched_course_* = 중복 제거 누적,
 *   reason_template = 가장 높은 priority 행의 것 (정렬상 첫 진입 행)
 */
export async function getRecommendationsForCourses(
  courseIds: number[],
): Promise<RecommendationGroup[]> {
  if (courseIds.length === 0) {
    return []
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('course_recommendations')
    .select(REC_SELECT)
    .in('course_id', courseIds)
    .order('priority', { ascending: false })
    .order('item_category_id', { ascending: true })

  if (error) {
    throw new Error(
      `[recommendations.getRecommendationsForCourses] ${error.message}`,
    )
  }

  const rows = (data ?? []) as unknown as RecRow[]
  const groups = new Map<number, RecommendationGroup>()

  for (const row of rows) {
    if (!row.item_categories) continue

    const courseName = row.courses?.name ?? null
    const existing = groups.get(row.item_category_id)

    if (existing) {
      if (!existing.matched_course_ids.includes(row.course_id)) {
        existing.matched_course_ids.push(row.course_id)
      }
      if (courseName && !existing.matched_course_names.includes(courseName)) {
        existing.matched_course_names.push(courseName)
      }
      // priority DESC 정렬이라 첫 진입 행이 항상 최댓값 → reason_template 갱신 불필요.
    } else {
      groups.set(row.item_category_id, {
        item_category_id: row.item_category_id,
        item_category_name: row.item_categories.name,
        item_category_type: row.item_categories.type,
        item_category_description: row.item_categories.description,
        category_id: row.item_categories.category_id,
        matched_course_ids: [row.course_id],
        matched_course_names: courseName ? [courseName] : [],
        reason_template: row.reason_template,
        priority: row.priority,
      })
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.priority - a.priority)
}

/**
 * 내 수강 과목 기반 추천 카테고리 목록 — 추천 결과 페이지의 메인 진입점.
 *
 * getMyCourseIds + getRecommendationsForCourses 합성.
 * 등록 과목 0 건이면 자연스럽게 [] 반환.
 */
export async function getMyRecommendations(
  semester: string,
): Promise<RecommendationGroup[]> {
  const courseIds = await getMyCourseIds(semester)
  return getRecommendationsForCourses(courseIds)
}
