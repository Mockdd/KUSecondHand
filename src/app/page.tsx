'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { type ExchangeStudent } from '@/types/exchange'

/**
 * 메인 대시보드
 *
 * - 디자인 최소화 — Tailwind 기본 클래스만 사용
 * - 기능 동작 확인 목적
 * - 온보딩 없음 — DB에 직접 데이터 삽입하여 테스트
 *
 * 분기:
 *   미로그인          → 로그인 안내 + 버튼
 *   role = incoming  → 바이어 메뉴 (패키지 추천, 채팅, 위시리스트)
 *   role = outgoing  → 셀러 메뉴 (패키지 등록, 매칭 현황, 채팅)
 *   profile 없음     → DB 세팅 안내
 */

type AuthState = 'loading' | 'unauthenticated' | 'no_profile' | 'ready'

export default function HomePage() {
  const supabase = createClient()

  const [authState, setAuthState] = useState<AuthState>('loading')
  const [profile, setProfile] = useState<ExchangeStudent | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      // 1. 로그인 세션 확인
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setAuthState('unauthenticated')
        return
      }

      setUserEmail(user.email ?? null)

      // 2. 교환학생 프로필 조회
      const { data, error } = await supabase
        .from('exchange_students')
        .select('*')
        .eq('uid', user.id)
        .single()

      if (error || !data) {
        setAuthState('no_profile')
        return
      }

      setProfile(data as ExchangeStudent)
      setAuthState('ready')
    }

    loadProfile()
  }, [supabase])

  // ── 로그아웃 ─────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setAuthState('unauthenticated')
    setProfile(null)
  }

  // ── 로딩 ─────────────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div className="p-8">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  // ── 미로그인 — 개발용: 로그인 없이 전체 메뉴 표시 ──────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">KU 교환학생 중고거래</h1>
          <Link href="/login" className="text-xs text-gray-500 underline">로그인</Link>
        </div>
        <div className="border border-yellow-300 bg-yellow-50 p-3 rounded mb-6 text-xs text-yellow-700">
          개발 모드 — 로그인 없이 탐색 중
        </div>
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">바이어 메뉴</h2>
          <nav className="flex flex-col gap-2">
            <Link href="/packages" className="px-4 py-2 bg-black text-white text-sm rounded">패키지 추천 보기</Link>
            <Link href="/chat" className="px-4 py-2 border border-gray-300 text-sm rounded">채팅 목록</Link>
            <Link href="/wishlist" className="px-4 py-2 border border-gray-300 text-sm rounded">알림 신청 목록</Link>
            <Link href="/mypage" className="px-4 py-2 border border-gray-300 text-sm rounded">마이페이지</Link>
          </nav>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">셀러 메뉴</h2>
          <nav className="flex flex-col gap-2">
            <Link href="/sell/template" className="px-4 py-2 bg-black text-white text-sm rounded">패키지 등록하기</Link>
            <Link href="/packages" className="px-4 py-2 border border-gray-300 text-sm rounded">내 패키지 현황</Link>
            <Link href="/sell/hygiene" className="px-4 py-2 border border-gray-300 text-sm rounded">세탁 인증 등록</Link>
          </nav>
        </div>
      </div>
    )
  }

  // ── 프로필 없음 (DB 미설정) ───────────────────────────────────────────────
  if (authState === 'no_profile') {
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold mb-4">KU 교환학생 중고거래</h1>
        <p className="text-gray-500 text-sm mb-2">로그인: {userEmail}</p>
        <div className="border border-yellow-300 bg-yellow-50 p-4 rounded mb-6">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            교환학생 프로필이 없어요 (개발용 안내)
          </p>
          <p className="text-xs text-yellow-700">
            Supabase 대시보드 → exchange_students 테이블에 직접 데이터를 삽입해주세요.
          </p>
          <pre className="mt-2 text-xs bg-yellow-100 p-2 rounded overflow-x-auto">
{`INSERT INTO exchange_students (
  uid, country_id, region_group, housing_type,
  semester, language_pref, role, onboarding_completed
) VALUES (
  '본인-uid', 3, 'E3', 'dorm',
  '2026-1', 'ko', 'incoming', TRUE
);`}
          </pre>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 border border-gray-300 text-sm rounded"
        >
          로그아웃
        </button>
      </div>
    )
  }

  // ── 정상 진입 ─────────────────────────────────────────────────────────────
  const isIncoming = profile?.role === 'incoming'
  const isSeller = profile?.role === 'outgoing'

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">KU 교환학생 중고거래</h1>
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-500 underline"
        >
          로그아웃
        </button>
      </div>

      {/* 프로필 요약 */}
      <div className="border border-gray-200 rounded p-4 mb-6 text-sm">
        <p className="text-gray-500 mb-1">{userEmail}</p>
        <p>
          역할:{' '}
          <span className="font-medium">
            {isIncoming ? 'Incoming (바이어)' : 'Outgoing (셀러)'}
          </span>
        </p>
        <p>
          지역:{' '}
          <span className="font-medium">{profile?.region_group ?? '미설정'}</span>
        </p>
        <p>
          거주형태:{' '}
          <span className="font-medium">{profile?.housing_type ?? '미설정'}</span>
        </p>
        <p>
          학기:{' '}
          <span className="font-medium">{profile?.semester ?? '미설정'}</span>
        </p>
      </div>

      {/* 바이어 메뉴 */}
      {isIncoming && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            바이어 메뉴
          </h2>
          <nav className="flex flex-col gap-2">
            <Link
              href="/packages"
              className="px-4 py-2 bg-black text-white text-sm rounded"
            >
              패키지 추천 보기
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2 border border-gray-300 text-sm rounded"
            >
              채팅 목록
            </Link>
            <Link
              href="/wishlist"
              className="px-4 py-2 border border-gray-300 text-sm rounded"
            >
              알림 신청 목록
            </Link>
            <Link
              href="/mypage"
              className="px-4 py-2 border border-gray-300 text-sm rounded"
            >
              마이페이지
            </Link>
          </nav>
        </div>
      )}

      {/* 셀러 메뉴 */}
      {isSeller && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
            셀러 메뉴
          </h2>
          <nav className="flex flex-col gap-2">
            <Link
              href="/sell/template"
              className="px-4 py-2 bg-black text-white text-sm rounded"
            >
              패키지 등록하기
            </Link>
            <Link
              href="/packages"
              className="px-4 py-2 border border-gray-300 text-sm rounded"
            >
              내 패키지 현황
            </Link>
            <Link
              href="/sell/hygiene"
              className="px-4 py-2 border border-gray-300 text-sm rounded"
            >
              세탁 인증 관리
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2 border border-gray-300 text-sm rounded"
            >
              채팅 목록
            </Link>
            <Link
              href="/mypage"
              className="px-4 py-2 border border-gray-300 text-sm rounded"
            >
              마이페이지
            </Link>
          </nav>
        </div>
      )}
    </div>
  )
}
