'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { ProfileAnimalAvatar } from '@/components/profile/ProfileAnimalAvatar'

type Major = { major_id: number; name: string }

type ProfilePayload = {
  uid: string
  email?: string
  nickname: string
  bio: string | null
  profile_image_url: string | null
  preferred_region_id: number | null
  major_id?: number | null
  grade?: number | null
  housing_type?: string | null
  club_name?: string | null
  student_id?: string
  school_domain?: string
  region_name?: string | null
  major_name?: string | null
}

function formatGrade(g: number | string | null | undefined): string {
  if (g == null || g === '') return '—'
  const n = typeof g === 'string' ? Number.parseInt(g, 10) : g
  if (!Number.isFinite(n) || n < 1 || n > 4) return '—'
  return `${n}학년`
}

function formatHousing(h: string | null | undefined): string {
  if (h === 'dorm') return '기숙사'
  if (h === 'flat') return '자취'
  return '—'
}

export function ProfileForm() {
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [majors, setMajors] = useState<Major[]>([])

  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [majorId, setMajorId] = useState('')
  const [gradeStr, setGradeStr] = useState('')
  const [housingStr, setHousingStr] = useState('')
  const [club, setClub] = useState('')

  const syncFormFromProfile = useCallback((p: ProfilePayload) => {
    setNickname(p.nickname ?? '')
    setBio(p.bio ?? '')
    setMajorId(p.major_id != null ? String(p.major_id) : '')
    setGradeStr(p.grade != null && p.grade >= 1 && p.grade <= 4 ? String(p.grade) : '')
    setHousingStr(p.housing_type === 'dorm' || p.housing_type === 'flat' ? p.housing_type : '')
    setClub(p.club_name ?? '')
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pr, mj] = await Promise.all([
        fetch('/api/profile', { credentials: 'include' }),
        fetch('/api/majors', { credentials: 'include' }),
      ])

      if (!pr.ok) {
        const j = await pr.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? '프로필을 불러오지 못했습니다.')
      }

      const profileJson = (await pr.json()) as { profile: ProfilePayload }
      const p = profileJson.profile
      setProfile(p)
      syncFormFromProfile(p)

      if (mj.ok) {
        const mjJson = (await mj.json()) as { majors: Major[] }
        setMajors(mjJson.majors ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [syncFormFromProfile])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    const body: Record<string, unknown> = {
      nickname: nickname.trim(),
      bio: bio.trim() || null,
      grade: gradeStr === '' ? null : Number.parseInt(gradeStr, 10),
      housing_type: housingStr === '' ? null : housingStr,
      club_name: club.trim() === '' ? null : club.trim(),
    }
    if (majors.length > 0) {
      body.major_id = majorId === '' ? null : Number.parseInt(majorId, 10)
    }

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    const j = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError((j as { error?: string }).error ?? '저장에 실패했습니다.')
      return
    }

    setSuccess('저장했습니다.')
    setEditing(false)
    await load()
  }

  function openEdit() {
    if (!profile) return
    syncFormFromProfile(profile)
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    if (!profile) return
    syncFormFromProfile(profile)
    setEditing(false)
    setError(null)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>
  }

  if (!profile) {
    return <p className="text-sm text-red-600">{error ?? '프로필을 불러올 수 없습니다.'}</p>
  }

  const accountBlock = (
    <section className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[#8B0029] mb-3">계정 정보</h2>
      <dl className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-2 text-sm text-gray-700 mb-4">
        <dt className="text-gray-500">이메일</dt>
        <dd className="break-all text-gray-900">{profile.email ?? '—'}</dd>
        <dt className="text-gray-500">학번</dt>
        <dd className="text-gray-900">{profile.student_id ?? '—'}</dd>
        <dt className="text-gray-500">학교 메일 도메인</dt>
        <dd className="text-gray-900">{profile.school_domain ?? '—'}</dd>
      </dl>
      <div className="flex flex-col gap-3 border-t border-gray-200 pt-4">
        <SignOutButton />
        <Link
          href="/my/account"
          className="text-sm font-medium text-red-600 hover:text-red-700 w-fit"
        >
          회원 탈퇴
        </Link>
      </div>
    </section>
  )

  return (
    <div className="max-w-xl space-y-8">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</p>
      ) : null}

      {!editing ? (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <ProfileAnimalAvatar uid={profile.uid} />
              <div className="flex flex-1 flex-col gap-3">
                <h2 className="text-sm font-semibold text-[#8B0029]">프로필</h2>
                <dl className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-2 text-sm text-gray-700">
                  <dt className="text-gray-500">닉네임</dt>
                  <dd className="font-medium text-gray-900">{profile.nickname}</dd>
                  <dt className="text-gray-500">한 줄 소개</dt>
                  <dd className="whitespace-pre-wrap text-gray-800">
                    {profile.bio?.trim() ? profile.bio : '—'}
                  </dd>
                  <dt className="text-gray-500">학과</dt>
                  <dd className="text-gray-900">{profile.major_name?.trim() ? profile.major_name : '—'}</dd>
                  <dt className="text-gray-500">학년</dt>
                  <dd className="text-gray-900">{formatGrade(profile.grade)}</dd>
                  <dt className="text-gray-500">거주 형태</dt>
                  <dd className="text-gray-900">{formatHousing(profile.housing_type ?? undefined)}</dd>
                  <dt className="text-gray-500">동아리</dt>
                  <dd className="whitespace-pre-wrap text-gray-900">
                    {profile.club_name?.trim() ? profile.club_name : '—'}
                  </dd>
                </dl>
                <button
                  type="button"
                  onClick={openEdit}
                  className="self-start rounded-lg bg-[#8B0029] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6B0020]"
                >
                  프로필 수정
                </button>
              </div>
            </div>
          </section>

          {accountBlock}
        </>
      ) : (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ProfileAnimalAvatar uid={profile.uid} />
              <p className="text-sm text-gray-500">
                프로필 이미지는 계정마다 고정된 동물 캐릭터로 표시돼요.
              </p>
            </div>
          </section>

          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <h2 className="font-semibold text-[#8B0029]">프로필 수정</h2>

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                닉네임
              </label>
              <input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={50}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
                disabled={saving}
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                한 줄 소개
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="자기소개를 입력하세요"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-400">{bio.length} / 500</p>
            </div>

            {majors.length > 0 ? (
              <div>
                <label htmlFor="major" className="block text-sm font-medium text-gray-700 mb-1">
                  학과
                </label>
                <select
                  id="major"
                  value={majorId}
                  onChange={(e) => setMajorId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
                  disabled={saving}
                >
                  <option value="">선택 안 함</option>
                  {majors.map((m) => (
                    <option key={m.major_id} value={m.major_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-1">
                학년
              </label>
              <select
                id="grade"
                value={gradeStr}
                onChange={(e) => setGradeStr(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
                disabled={saving}
              >
                <option value="">선택 안 함</option>
                <option value="1">1학년</option>
                <option value="2">2학년</option>
                <option value="3">3학년</option>
                <option value="4">4학년</option>
              </select>
            </div>

            <div>
              <label htmlFor="housing" className="block text-sm font-medium text-gray-700 mb-1">
                거주 형태
              </label>
              <select
                id="housing"
                value={housingStr}
                onChange={(e) => setHousingStr(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
                disabled={saving}
              >
                <option value="">선택 안 함</option>
                <option value="dorm">기숙사</option>
                <option value="flat">자취</option>
              </select>
            </div>

            <div>
              <label htmlFor="club" className="block text-sm font-medium text-gray-700 mb-1">
                동아리
              </label>
              <input
                id="club"
                value={club}
                onChange={(e) => setClub(e.target.value)}
                maxLength={200}
                placeholder="동아리명을 입력하세요"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-[#8B0029] focus:outline-none focus:ring-1 focus:ring-[#8B0029]"
                disabled={saving}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#8B0029] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B0020] disabled:opacity-50"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </form>

          {accountBlock}
        </>
      )}
    </div>
  )
}
