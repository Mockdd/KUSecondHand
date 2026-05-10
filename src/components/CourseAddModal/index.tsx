'use client'

import { useEffect, useRef, useState } from 'react'
import {
  searchCoursesByGrade,
  searchCoursesByKeyword,
  searchCoursesByMajor,
} from '@lib/queries/courses'
import { listMajorsGroupedByCollege } from '@lib/queries/majors'
import { addUserCourse } from '@lib/queries/user-courses'
import type { CourseSearchResult, MajorOption } from '@lib/queries/types'
import CourseResultList from './CourseResultList'

const SEMESTER = '2026-1'

type SearchField = 'name' | 'professor' | 'code'
type ActiveTab = 'search' | 'major' | 'grade'
type MajorCategory = 'major' | 'liberal' | 'teaching' | null
type GroupedMajors = Record<string, MajorOption[]>

const MAJOR_CATS: ReadonlyArray<{
  value: Exclude<MajorCategory, null>
  label: string
}> = [
  { value: 'major', label: '전공' },
  { value: 'liberal', label: '교양' },
  { value: 'teaching', label: '교직' },
]

const FIELD_KO: Record<SearchField, string> = {
  name: '과목명',
  professor: '교수명',
  code: '과목코드',
}

const FIELD_PLACEHOLDER: Record<SearchField, string> = {
  name: '과목명을 입력하세요',
  professor: '교수명을 입력하세요',
  code: '과목코드를 입력하세요',
}

const FIELD_EMPTY_MSG: Record<SearchField, string> = {
  name: '과목명을 입력하면 결과가 보여요',
  professor: '교수명을 입력하면 결과가 보여요',
  code: '과목코드를 입력하면 결과가 보여요',
}

const GRADES = [1, 2, 3, 4] as const

interface FlashMsg {
  courseId: number
  kind: 'success' | 'error'
  text: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onCourseAdded: () => void
}

export default function CourseAddModal({
  isOpen,
  onClose,
  onCourseAdded,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('search')

  // 검색어 탭 state
  const [field, setField] = useState<SearchField>('name')
  const [input, setInput] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [results, setResults] = useState<CourseSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // 학년 탭 state
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [gradeResults, setGradeResults] = useState<CourseSearchResult[]>([])
  const [gradeLoading, setGradeLoading] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)

  // 전공/영역 탭 state
  const [majorCategory, setMajorCategory] = useState<MajorCategory>(null)
  const [majorList, setMajorList] = useState<GroupedMajors | null>(null)
  const [majorListLoading, setMajorListLoading] = useState(false)
  const [majorListError, setMajorListError] = useState<string | null>(null)
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null)
  const [majorCourseResults, setMajorCourseResults] = useState<
    CourseSearchResult[]
  >([])
  const [majorCourseLoading, setMajorCourseLoading] = useState(false)
  const [majorCourseError, setMajorCourseError] = useState<string | null>(null)

  // 모달 전체 공유 state (탭 격리 X)
  const [addingCourseId, setAddingCourseId] = useState<number | null>(null)
  const [flashMsg, setFlashMsg] = useState<FlashMsg | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // 모달 닫힐 때 내부 state 초기화
  useEffect(() => {
    if (isOpen) return
    setActiveTab('search')
    setField('name')
    setInput('')
    setDebouncedKeyword('')
    setResults([])
    setSearching(false)
    setSearchError(null)
    setSelectedGrade(null)
    setGradeResults([])
    setGradeLoading(false)
    setGradeError(null)
    setMajorCategory(null)
    setMajorList(null)
    setMajorListLoading(false)
    setMajorListError(null)
    setSelectedMajorId(null)
    setMajorCourseResults([])
    setMajorCourseLoading(false)
    setMajorCourseError(null)
    setAddingCourseId(null)
    setFlashMsg(null)
  }, [isOpen])

  // ESC 키 → 닫기
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // body 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  // 모달 열림 + 검색어 탭일 때 input 자동 포커스
  useEffect(() => {
    if (isOpen && activeTab === 'search') {
      inputRef.current?.focus()
    }
  }, [isOpen, activeTab])

  // 디바운싱: input → debouncedKeyword (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedKeyword(input.trim())
    }, 300)
    return () => clearTimeout(t)
  }, [input])

  // 검색 트리거
  useEffect(() => {
    if (debouncedKeyword === '') {
      setResults([])
      setSearchError(null)
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    setSearchError(null)
    searchCoursesByKeyword(debouncedKeyword, field)
      .then((data) => {
        if (cancelled) return
        setResults(data)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setSearchError(
          e instanceof Error ? e.message : '검색 중 오류가 발생했습니다.',
        )
        setResults([])
      })
      .finally(() => {
        if (cancelled) return
        setSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedKeyword, field])

  // 학년 검색 트리거
  useEffect(() => {
    if (selectedGrade === null) {
      setGradeResults([])
      setGradeError(null)
      setGradeLoading(false)
      return
    }
    let cancelled = false
    setGradeLoading(true)
    setGradeError(null)
    searchCoursesByGrade(selectedGrade)
      .then((data) => {
        if (cancelled) return
        setGradeResults(data)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setGradeError(
          e instanceof Error ? e.message : '검색 중 오류가 발생했습니다.',
        )
        setGradeResults([])
      })
      .finally(() => {
        if (cancelled) return
        setGradeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedGrade])

  // 전공 카테고리 진입 시 학과 목록 lazy fetch (모달 단위 캐시)
  useEffect(() => {
    if (majorCategory !== 'major') return
    if (majorList !== null) return
    let cancelled = false
    setMajorListLoading(true)
    setMajorListError(null)
    listMajorsGroupedByCollege()
      .then((data) => {
        if (cancelled) return
        setMajorList(data)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setMajorListError(
          e instanceof Error ? e.message : '전공 목록을 불러오지 못했습니다.',
        )
      })
      .finally(() => {
        if (cancelled) return
        setMajorListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [majorCategory, majorList])

  // 학과별 과목 fetch
  useEffect(() => {
    if (selectedMajorId === null) {
      setMajorCourseResults([])
      setMajorCourseError(null)
      setMajorCourseLoading(false)
      return
    }
    let cancelled = false
    setMajorCourseLoading(true)
    setMajorCourseError(null)
    searchCoursesByMajor(selectedMajorId)
      .then((data) => {
        if (cancelled) return
        setMajorCourseResults(data)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setMajorCourseError(
          e instanceof Error ? e.message : '검색 중 오류가 발생했습니다.',
        )
        setMajorCourseResults([])
      })
      .finally(() => {
        if (cancelled) return
        setMajorCourseLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedMajorId])

  // flash 메시지 3초 후 자동 사라짐
  useEffect(() => {
    if (!flashMsg) return
    const t = setTimeout(() => setFlashMsg(null), 3000)
    return () => clearTimeout(t)
  }, [flashMsg])

  function handleMajorCategorySelect(cat: Exclude<MajorCategory, null>) {
    if (cat === majorCategory) return
    setMajorCategory(cat)
    setSelectedMajorId(null)
    setMajorCourseResults([])
    setMajorCourseError(null)
  }

  async function handleSelect(course: CourseSearchResult) {
    if (addingCourseId !== null) return
    setAddingCourseId(course.course_id)
    try {
      await addUserCourse(course.course_id, SEMESTER)
      setFlashMsg({
        courseId: course.course_id,
        kind: 'success',
        text: '추가됨',
      })
      onCourseAdded()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      if (msg === 'ALREADY_ADDED') {
        setFlashMsg({
          courseId: course.course_id,
          kind: 'error',
          text: '이미 추가된 과목입니다',
        })
      } else {
        setFlashMsg({ courseId: course.course_id, kind: 'error', text: msg })
      }
    } finally {
      setAddingCourseId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-add-modal-title"
        className="relative max-w-md mx-auto mt-10 bg-white rounded-lg shadow-lg max-h-[80vh] flex flex-col"
      >
        <header className="flex items-center justify-between p-4 border-b">
          <h2 id="course-add-modal-title" className="text-base font-semibold">
            과목 추가
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            닫기
          </button>
        </header>

        <nav className="flex border-b" aria-label="검색 방식">
          <button
            type="button"
            onClick={() => setActiveTab('major')}
            className={`flex-1 py-2 text-sm border-b-2 ${
              activeTab === 'major'
                ? 'border-black font-medium'
                : 'border-transparent text-gray-600'
            }`}
          >
            전공/영역
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 text-sm border-b-2 ${
              activeTab === 'search'
                ? 'border-black font-medium'
                : 'border-transparent text-gray-600'
            }`}
          >
            검색어
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grade')}
            className={`flex-1 py-2 text-sm border-b-2 ${
              activeTab === 'grade'
                ? 'border-black font-medium'
                : 'border-transparent text-gray-600'
            }`}
          >
            학년
          </button>
        </nav>

        {activeTab === 'search' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 space-y-3 border-b">
              <fieldset className="flex gap-3 text-sm">
                <legend className="sr-only">검색 기준</legend>
                {(['name', 'professor', 'code'] as const).map((f) => (
                  <label key={f} className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="search-field"
                      value={f}
                      checked={field === f}
                      onChange={() => setField(f)}
                    />
                    {FIELD_KO[f]}
                  </label>
                ))}
              </fieldset>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={FIELD_PLACEHOLDER[field]}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            {searchError && (
              <div className="m-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {searchError}
              </div>
            )}

            <CourseResultList
              results={results}
              onSelect={handleSelect}
              addingCourseId={addingCourseId}
              flashMsg={flashMsg}
              loading={searching}
              emptyHint={FIELD_EMPTY_MSG[field]}
              emptyResult="검색 결과가 없어요"
              hasQueried={debouncedKeyword !== ''}
            />
          </div>
        )}

        {activeTab === 'grade' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex gap-2 text-sm">
                {GRADES.map((g) => {
                  const active = selectedGrade === g
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className={`px-3 py-1 rounded-full border ${
                        active
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {g}학년
                    </button>
                  )
                })}
              </div>
            </div>

            {gradeError && (
              <div className="m-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                {gradeError}
              </div>
            )}

            <CourseResultList
              results={gradeResults}
              onSelect={handleSelect}
              addingCourseId={addingCourseId}
              flashMsg={flashMsg}
              loading={gradeLoading}
              emptyHint="학년을 선택하세요"
              emptyResult="해당 학년 과목이 없어요"
              hasQueried={selectedGrade !== null}
            />
          </div>
        )}

        {activeTab === 'major' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex gap-2 text-sm">
                {MAJOR_CATS.map(({ value, label }) => {
                  const active = majorCategory === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleMajorCategorySelect(value)}
                      className={`px-3 py-1 rounded-full border ${
                        active
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {majorCategory === null && (
              <p className="p-4 text-sm text-gray-500">
                전공/교양/교직 중 선택하세요
              </p>
            )}

            {(majorCategory === 'liberal' || majorCategory === 'teaching') && (
              <p className="p-4 text-sm text-gray-500">곧 추가됩니다</p>
            )}

            {majorCategory === 'major' && (
              <>
                <div className="p-4 border-b max-h-[30vh] overflow-y-auto space-y-3">
                  {majorListLoading && (
                    <p className="text-sm text-gray-500">
                      전공 목록 불러오는 중...
                    </p>
                  )}
                  {majorListError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                      {majorListError}
                    </div>
                  )}
                  {!majorListLoading &&
                    !majorListError &&
                    majorList !== null &&
                    Object.entries(majorList).map(([college, majors]) => (
                      <section key={college}>
                        <h4 className="text-xs font-semibold text-gray-500 mb-1">
                          {college}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {majors.map((m) => {
                            const active = selectedMajorId === m.major_id
                            return (
                              <button
                                key={m.major_id}
                                type="button"
                                onClick={() => setSelectedMajorId(m.major_id)}
                                className={`px-3 py-1 rounded-full border text-sm ${
                                  active
                                    ? 'bg-black text-white border-black'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {m.name}
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    ))}
                </div>

                {majorCourseError && (
                  <div className="m-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                    {majorCourseError}
                  </div>
                )}

                <CourseResultList
                  results={majorCourseResults}
                  onSelect={handleSelect}
                  addingCourseId={addingCourseId}
                  flashMsg={flashMsg}
                  loading={majorCourseLoading}
                  emptyHint="학과를 선택하세요"
                  emptyResult="이 학과 과목이 등록돼있지 않아요"
                  hasQueried={selectedMajorId !== null}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
