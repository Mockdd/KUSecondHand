'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ActivityRegionAuto } from '@/components/profile/ActivityRegionAuto'
import { TrustBadge } from '@/components/trust/TrustBadge'
import { isTrustedSeller } from '@/lib/trust/constants'

type Region = { region_id: number; name: string }
type Major = { major_id: number; name: string }

type ProfilePayload = {
  uid: string
  email?: string
  nickname: string
  bio: string | null
  profile_image_url: string | null
  preferred_region_id: number | null
  major_id?: number | null
  student_id?: string
  school_domain?: string
  manner_temperature?: number
  trade_count?: number
  successful_trade_count?: number
  region_name?: string | null
  major_name?: string | null
}

export function ProfileForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [regions, setRegions] = useState<Region[]>([])
  const [majors, setMajors] = useState<Major[]>([])

  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [preferredRegionId, setPreferredRegionId] = useState<string>('')
  const [majorId, setMajorId] = useState<string>('')

  const selectedRegionLabel = useMemo(() => {
    if (!preferredRegionId) return profile?.region_name ?? null
    const id = Number.parseInt(preferredRegionId, 10)
    const hit = regions.find((r) => r.region_id === id)
    return hit?.name ?? profile?.region_name ?? null
  }, [preferredRegionId, regions, profile?.region_name])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pr, rg, mj] = await Promise.all([
        fetch('/api/profile', { credentials: 'include' }),
        fetch('/api/regions', { credentials: 'include' }),
        fetch('/api/majors', { credentials: 'include' }),
      ])

      if (!pr.ok) {
        const j = await pr.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? '프로필을 불러오지 못했습니다.')
      }

      const profileJson = (await pr.json()) as { profile: ProfilePayload }
      const p = profileJson.profile
      setProfile(p)
      setNickname(p.nickname ?? '')
      setBio(p.bio ?? '')
      setPreferredRegionId(
        p.preferred_region_id != null ? String(p.preferred_region_id) : '',
      )
      setMajorId(p.major_id != null ? String(p.major_id) : '')

      if (rg.ok) {
        const rj = (await rg.json()) as { regions: Region[] }
        setRegions(rj.regions ?? [])
      }
      if (mj.ok) {
        const mjJson = (await mj.json()) as { majors: Major[] }
        setMajors(mjJson.majors ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

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
      preferred_region_id:
        preferredRegionId === '' ? null : Number.parseInt(preferredRegionId, 10),
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
    await load()
  }

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다.')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      const ext =
        file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '')?.toLowerCase() || 'jpg'
      const path = `${user.id}/avatar_${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })

      if (upErr) {
        throw new Error(
          upErr.message.includes('Bucket not found')
            ? '스토리지 버킷 avatars 가 없습니다. Supabase에서 버킷을 만든 뒤 다시 시도하세요.'
            : upErr.message,
        )
      }

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = pub.publicUrl

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profile_image_url: publicUrl }),
      })

      const pj = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((pj as { error?: string }).error ?? '프로필 URL 저장에 실패했습니다.')
      }

      setSuccess('프로필 사진을 반영했습니다.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  async function clearAvatar() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ profile_image_url: null }),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? '삭제에 실패했습니다.')
      return
    }
    setSuccess('프로필 사진을 삭제했습니다.')
    await load()
  }

  if (loading) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>
  }

  if (!profile) {
    return <p className="text-sm text-red-600">{error ?? '프로필을 불러올 수 없습니다.'}</p>
  }

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

      <section className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200">
          {profile.profile_image_url ? (
            <Image
              src={profile.profile_image_url}
              alt=""
              fill
              className="object-cover"
              sizes="112px"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-gray-400">
              ?
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="inline-flex">
            <span className="rounded-lg bg-white px-3 py-2 font-medium text-indigo-600 ring-1 ring-gray-300 hover:bg-gray-50 cursor-pointer">
              {uploading ? '업로드 중…' : '사진 변경'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              disabled={uploading || saving}
              onChange={handlePickFile}
            />
          </label>
          {profile.profile_image_url ? (
            <button
              type="button"
              onClick={() => void clearAvatar()}
              disabled={saving || uploading}
              className="text-left text-sm text-red-600 hover:text-red-500 disabled:opacity-50"
            >
              사진 삭제
            </button>
          ) : null}
          <p className="text-xs text-gray-500">JPEG·PNG·WebP·GIF, 최대 5MB. 버킷 이름: avatars</p>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
        <p className="text-xs font-medium text-emerald-900 uppercase tracking-wide">활동 지역</p>
        <p className="mt-1 text-lg font-semibold text-gray-900">
          {selectedRegionLabel ?? (
            <span className="text-gray-400 font-normal">아직 설정되지 않음 · 아래에서 위치 또는 목록으로 설정</span>
          )}
        </p>
        <p className="mt-2 text-xs text-gray-600">
          거래 노출·지역 그룹핑에는 이 활동 지역(`preferred_region_id`)이 사용됩니다.
        </p>
      </section>

      <ActivityRegionAuto
        disabled={saving || uploading}
        onResolved={(regionId) => {
          setPreferredRegionId(String(regionId))
          setSuccess(null)
          setError(null)
        }}
      />

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3 text-sm">
        <h2 className="font-semibold text-gray-900">계정 정보</h2>
        <dl className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-2 text-gray-700">
          <dt className="text-gray-500">이메일</dt>
          <dd className="break-all">{profile.email ?? '—'}</dd>
          <dt className="text-gray-500">학번</dt>
          <dd>{profile.student_id ?? '—'}</dd>
          <dt className="text-gray-500">학교 메일 도메인</dt>
          <dd>{profile.school_domain ?? '—'}</dd>
          <dt className="text-gray-500">매너 온도</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span>{profile.manner_temperature ?? '—'}</span>
            <span className="text-xs text-gray-500">(받은 리뷰 별점 기준)</span>
          </dd>
          <dt className="text-gray-500">신뢰 뱃지</dt>
          <dd>
            <TrustBadge trusted={isTrustedSeller(profile.successful_trade_count)} />
            {!isTrustedSeller(profile.successful_trade_count) ? (
              <span className="text-gray-400">성공 거래 2회 이상 시 표시</span>
            ) : null}
          </dd>
          <dt className="text-gray-500">성공 거래</dt>
          <dd>{profile.successful_trade_count ?? 0} · 구매·판매 모두 포함, 양쪽 만족 완료만 집계</dd>
          <dt className="text-gray-500">거래 횟수</dt>
          <dd>{profile.trade_count ?? '—'}</dd>
          {profile.major_name ? (
            <>
              <dt className="text-gray-500">전공</dt>
              <dd>{profile.major_name}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900">프로필 수정</h2>

        <div>
          <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
            닉네임
          </label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={50}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            disabled={saving}
          />
          <p className="mt-1 text-xs text-gray-400">{bio.length} / 500</p>
        </div>

        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
            활동 지역 (목록에서 직접 선택)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            위치 자동 설정이 실패하거나 부정확할 때만 수정하면 됩니다.
          </p>
          <select
            id="region"
            value={preferredRegionId}
            onChange={(e) => setPreferredRegionId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
            disabled={saving}
          >
            <option value="">선택 안 함</option>
            {regions.map((r) => (
              <option key={r.region_id} value={r.region_id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {majors.length > 0 ? (
          <div>
            <label htmlFor="major" className="block text-sm font-medium text-gray-700 mb-1">
              전공
            </label>
            <select
              id="major"
              value={majorId}
              onChange={(e) => setMajorId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
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

        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </form>
    </div>
  )
}
