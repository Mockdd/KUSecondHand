import { createClient } from '@lib/supabase/client'
import type { MajorOption } from './types'

const FALLBACK_COLLEGE_LABEL = '기타'

interface MajorRow {
  major_id: number
  name: string
  college: string | null
}

/**
 * 단과대학별로 그룹화된 전공 목록을 반환한다.
 *
 * - 정렬: college 사전식 → 그 안에서 name 사전식 (PostgreSQL ORDER BY 의존)
 * - college 가 NULL 인 전공은 '기타' 그룹으로 묶이며,
 *   반환 객체에서 항상 마지막 키로 배치된다.
 *
 * @returns 예) { "경영대학": [...], "정보대학": [...], "기타": [...] }
 */
export async function listMajorsGroupedByCollege(): Promise<
  Record<string, MajorOption[]>
> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('majors')
    .select('major_id, name, college')
    .order('college', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (error) {
    throw new Error(
      `[majors.listMajorsGroupedByCollege] ${error.message}`,
    )
  }

  const rows = (data ?? []) as MajorRow[]

  const grouped: Record<string, MajorOption[]> = {}
  const fallback: MajorOption[] = []

  for (const row of rows) {
    const option: MajorOption = {
      major_id: row.major_id,
      name: row.name,
    }
    if (row.college == null) {
      fallback.push(option)
      continue
    }
    if (!grouped[row.college]) {
      grouped[row.college] = []
    }
    grouped[row.college].push(option)
  }

  if (fallback.length > 0) {
    grouped[FALLBACK_COLLEGE_LABEL] = fallback
  }

  return grouped
}
