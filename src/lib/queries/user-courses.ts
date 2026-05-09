import { createClient } from '@lib/supabase/client'
import type { CourseScheduleSummary, MyCourseEntry } from './types'

const MY_COURSE_SELECT = `
  semester,
  created_at,
  courses (
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
  )
`

interface UserCourseRow {
  semester: string
  created_at: string
  courses: {
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
  } | null
}

/**
 * 현재 로그인된 사용자의 수강 과목 목록을 특정 학기로 조회한다.
 *
 * - user_courses → courses → course_schedules nested select (N+1 방지)
 * - RLS 가 본인 행만 자동 필터 (uid 명시 불필요)
 * - 정렬: course_code ASC (course_schedules 가 nested 라 client-side sort)
 */
export async function getMyCourses(semester: string): Promise<MyCourseEntry[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_courses')
    .select(MY_COURSE_SELECT)
    .eq('semester', semester)

  if (error) {
    throw new Error(`[user-courses.getMyCourses] ${error.message}`)
  }

  const rows = (data ?? []) as unknown as UserCourseRow[]

  return rows
    .filter(
      (r): r is UserCourseRow & { courses: NonNullable<UserCourseRow['courses']> } =>
        r.courses != null,
    )
    .map((r) => ({
      course_id: r.courses.course_id,
      course_code: r.courses.course_code,
      name: r.courses.name,
      professor: r.courses.professor,
      credit: r.courses.credit,
      grade_level: r.courses.grade_level,
      category_type: r.courses.category_type,
      major_id: r.courses.major_id,
      liberal_area: r.courses.liberal_area,
      schedules: r.courses.course_schedules ?? [],
      enrolled_at: r.created_at,
      semester: r.semester,
    }))
    .sort((a, b) => a.course_code.localeCompare(b.course_code))
}

/**
 * 현재 로그인된 사용자의 수강 과목을 등록한다.
 *
 * - user_courses 의 PK 가 (uid, course_id, semester) 라 unique violation(23505) 발생 시
 *   'ALREADY_ADDED' 라는 별도 메시지로 변환 (호출 측이 분기 처리 가능)
 * - uid 컬럼은 NOT NULL/DEFAULT 없음 → auth.getUser() 로 명시적으로 INSERT
 * - 미인증 시 명확한 에러 throw
 */
export async function addUserCourse(
  courseId: number,
  semester: string,
): Promise<void> {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('[user-courses.addUserCourse] 인증 필요')
  }

  const { error } = await supabase.from('user_courses').insert({
    uid: user.id,
    course_id: courseId,
    semester,
  })

  if (error) {
    if (error.code === '23505') {
      throw new Error('ALREADY_ADDED')
    }
    throw new Error(`[user-courses.addUserCourse] ${error.message}`)
  }
}

/**
 * 현재 로그인된 사용자의 수강 과목을 삭제한다.
 *
 * - RLS 가 본인 행만 삭제 보장 (uid 추가 필터 불필요)
 * - 행이 없어도 success (멱등)
 */
export async function removeUserCourse(
  courseId: number,
  semester: string,
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('user_courses')
    .delete()
    .eq('course_id', courseId)
    .eq('semester', semester)

  if (error) {
    throw new Error(`[user-courses.removeUserCourse] ${error.message}`)
  }
}

/**
 * 추천 조회용 가벼운 헬퍼 — 내 수강 과목의 course_id 만 추출.
 *
 * - recommendations.getMyRecommendations 가 내부적으로 호출
 * - 0 건이면 [] 반환 (호출 측에서 빈 배열 가드 활용)
 */
export async function getMyCourseIds(semester: string): Promise<number[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('user_courses')
    .select('course_id')
    .eq('semester', semester)

  if (error) {
    throw new Error(`[user-courses.getMyCourseIds] ${error.message}`)
  }

  const rows = (data ?? []) as unknown as { course_id: number }[]
  return rows.map((r) => r.course_id)
}
