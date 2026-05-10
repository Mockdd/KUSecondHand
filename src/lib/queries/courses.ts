import { createClient } from '@lib/supabase/client'
import type { CourseScheduleSummary, CourseSearchResult } from './types'

const COURSE_SELECT = `
  course_id,
  course_code,
  name,
  professor,
  credit,
  grade_level,
  category_type,
  major_id,
  liberal_area,
  course_schedules (
    day_of_week,
    start_time,
    end_time
  )
`

interface CourseRow {
  course_id: number
  course_code: string
  name: string
  professor: string | null
  credit: number | null
  grade_level: number | null
  category_type: string
  major_id: number | null
  liberal_area: string | null
  course_schedules: CourseScheduleSummary[] | null
}

function mapCourseRow(row: CourseRow): CourseSearchResult {
  return {
    course_id: row.course_id,
    course_code: row.course_code,
    name: row.name,
    professor: row.professor,
    credit: row.credit,
    grade_level: row.grade_level,
    category_type: row.category_type,
    major_id: row.major_id,
    liberal_area: row.liberal_area,
    schedules: row.course_schedules ?? [],
  }
}

/**
 * 특정 전공의 전공 과목을 조회한다.
 *
 * - category_type='major' 필터 + major_id 일치
 * - gradeLevel 지정 시 학년 추가 필터
 * - course_schedules 함께 조회 (LEFT JOIN, N+1 방지)
 * - 정렬: grade_level → course_code, 최대 100건
 */
export async function searchCoursesByMajor(
  majorId: number,
  gradeLevel?: number,
): Promise<CourseSearchResult[]> {
  const supabase = createClient()

  let query = supabase
    .from('courses')
    .select(COURSE_SELECT)
    .eq('category_type', 'major')
    .eq('major_id', majorId)

  if (gradeLevel != null) {
    query = query.eq('grade_level', gradeLevel)
  }

  const { data, error } = await query
    .order('grade_level', { ascending: true, nullsFirst: false })
    .order('course_code', { ascending: true })
    .limit(100)

  if (error) {
    throw new Error(`[courses.searchCoursesByMajor] ${error.message}`)
  }

  return ((data ?? []) as unknown as CourseRow[]).map(mapCourseRow)
}

/**
 * 키워드로 과목을 검색한다.
 *
 * - keyword 가 빈 문자열(trim 후)이면 DB 호출 없이 빈 배열 반환
 * - field='name' / 'professor' → 부분 일치 ILIKE %keyword%
 * - field='code' → 앞부분 일치 ILIKE keyword%
 * - course_schedules 함께 조회
 * - 정렬: 'code' 검색은 course_code, 그 외는 name 기준
 * - 최대 30건
 */
export async function searchCoursesByKeyword(
  keyword: string,
  field: 'name' | 'professor' | 'code',
): Promise<CourseSearchResult[]> {
  const trimmed = keyword.trim()
  if (trimmed === '') {
    return []
  }

  const supabase = createClient()

  let query = supabase.from('courses').select(COURSE_SELECT)

  if (field === 'name') {
    query = query.ilike('name', `%${trimmed}%`)
  } else if (field === 'professor') {
    query = query.ilike('professor', `%${trimmed}%`)
  } else {
    query = query.ilike('course_code', `${trimmed}%`)
  }

  const orderColumn = field === 'code' ? 'course_code' : 'name'

  const { data, error } = await query
    .order(orderColumn, { ascending: true })
    .limit(30)

  if (error) {
    throw new Error(`[courses.searchCoursesByKeyword] ${error.message}`)
  }

  return ((data ?? []) as unknown as CourseRow[]).map(mapCourseRow)
}

/**
 * 특정 학년의 모든 과목을 조회한다 (전공/교양/교직 무관).
 *
 * - course_schedules 함께 조회
 * - 정렬: category_type → course_code
 * - 최대 100건
 */
export async function searchCoursesByGrade(
  gradeLevel: number,
): Promise<CourseSearchResult[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_SELECT)
    .eq('grade_level', gradeLevel)
    .order('category_type', { ascending: true })
    .order('course_code', { ascending: true })
    .limit(100)

  if (error) {
    throw new Error(`[courses.searchCoursesByGrade] ${error.message}`)
  }

  return ((data ?? []) as unknown as CourseRow[]).map(mapCourseRow)
}
