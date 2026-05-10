'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useExchangeProfile } from '@/hooks/useExchangeProfile'

// ──────────────────────────────────────────────────────────────────────────────
// 로컬 타입
// ──────────────────────────────────────────────────────────────────────────────

interface HygieneItem {
  category_id: number
  category_name: string
}

interface CertRecord {
  cert_id: number
  category_id: number
  image_url: string
  status: 'pending' | 'approved' | 'rejected'
}

// ──────────────────────────────────────────────────────────────────────────────
// HygieneItemRow — 물품 1개 행
// ──────────────────────────────────────────────────────────────────────────────

interface HygieneItemRowProps {
  item: HygieneItem
  cert: CertRecord | null
  sellerUid: string
}

function HygieneItemRow({ item, cert, sellerUid }: HygieneItemRowProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showReuploadWarning, setShowReuploadWarning] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // ── 1. 파일 검증 ──────────────────────────────────────────────────────
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        throw new Error('JPG, PNG 파일만 업로드 가능해요')
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('파일 크기가 너무 커요. 10MB 이하로 업로드해주세요')
      }

      // ── 2. Storage 업로드 ─────────────────────────────────────────────────
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const storagePath = `${sellerUid}/${item.category_id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('hygiene-certs')
        .upload(storagePath, file, { contentType: file.type, upsert: true })

      if (uploadError) {
        throw new Error('업로드에 실패했어요. 다시 시도해주세요')
      }

      const { data: { publicUrl } } = supabase.storage
        .from('hygiene-certs')
        .getPublicUrl(storagePath)

      // ── 3. hygiene_certifications upsert ─────────────────────────────────
      const { error: dbError } = await supabase
        .from('hygiene_certifications')
        .upsert(
          {
            seller_uid: sellerUid,
            category_id: item.category_id,
            image_url: publicUrl,
            status: 'pending',
            reviewed_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'seller_uid,category_id' }
        )

      if (dbError) {
        throw new Error('인증 정보 저장에 실패했어요')
      }
    },
    onSuccess: () => {
      setLocalError(null)
      setShowReuploadWarning(false)
      queryClient.invalidateQueries({ queryKey: ['hygiene-certs', sellerUid] })
    },
    onError: (err: Error) => {
      setLocalError(err.message)
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalError(null)
    uploadMutation.mutate(file)
    // input 초기화 (같은 파일 재선택 가능하도록)
    e.target.value = ''
  }

  const handleUploadClick = () => {
    if (cert?.status === 'approved') {
      setShowReuploadWarning(true)
      return
    }
    fileInputRef.current?.click()
  }

  const handleConfirmReupload = () => {
    setShowReuploadWarning(false)
    fileInputRef.current?.click()
  }

  // ── 상태 배지 ─────────────────────────────────────────────────────────────
  const StatusBadge = () => {
    if (!cert) return null
    const map = {
      approved: 'border-green-500 text-green-700',
      pending:  'border-yellow-500 text-yellow-700',
      rejected: 'border-red-400 text-red-600',
    } as const
    const label = {
      approved: '세탁완료',
      pending:  '검토 중',
      rejected: '반려됨',
    } as const
    return (
      <span className={`text-xs border px-2 py-0.5 rounded ${map[cert.status]}`}>
        {label[cert.status]}
      </span>
    )
  }

  return (
    <div className="border border-gray-200 rounded p-4">
      {/* 물품명 + 상태 배지 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{item.category_name}</span>
        <StatusBadge />
      </div>

      {/* 반려 안내 */}
      {cert?.status === 'rejected' && (
        <p className="text-xs text-red-600 mb-2">
          인증이 반려됐어요. 사진을 다시 업로드해주세요.
        </p>
      )}

      {/* approved 재업로드 경고 */}
      {showReuploadWarning && (
        <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mb-2 text-xs text-yellow-800">
          이미 인증된 물품이에요. 재업로드 시 재검토가 필요해요.
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleConfirmReupload}
              className="px-2 py-1 bg-yellow-600 text-white rounded text-xs"
            >
              재업로드
            </button>
            <button
              onClick={() => setShowReuploadWarning(false)}
              className="px-2 py-1 border border-gray-300 rounded text-xs"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 업로드된 이미지 미리보기 */}
      {cert?.image_url && (
        <div className="mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cert.image_url}
            alt={`${item.category_name} 세탁 인증`}
            className="w-20 h-20 object-cover rounded border border-gray-200"
          />
        </div>
      )}

      {/* 에러 메시지 */}
      {localError && (
        <p className="text-xs text-red-600 mb-2">{localError}</p>
      )}

      {/* 업로드 버튼 */}
      {!showReuploadWarning && (
        <button
          onClick={handleUploadClick}
          disabled={uploadMutation.isPending}
          className="px-3 py-1.5 border border-gray-300 text-xs rounded disabled:opacity-50"
        >
          {uploadMutation.isPending
            ? '업로드 중...'
            : cert
            ? '재업로드'
            : '사진 업로드'}
        </button>
      )}

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// 셀 플로우 스텝 인디케이터
// ──────────────────────────────────────────────────────────────────────────────

function SellStepHeader({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['템플릿 선택', '물품 체크', '세탁 인증']
  return (
    <div className="flex items-center mb-6">
      {steps.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3
        const isDone = step < current
        const isActive = step === current
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border ${
                isActive ? 'bg-black text-white border-black' :
                isDone   ? 'bg-gray-300 text-white border-gray-300' :
                           'border-gray-200 text-gray-300'
              }`}>
                {isDone ? '✓' : step}
              </div>
              <span className={`text-xs whitespace-nowrap ${isActive ? 'text-black font-medium' : isDone ? 'text-gray-400' : 'text-gray-300'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 ${isDone ? 'bg-gray-300' : 'bg-gray-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// HygienePage
// ──────────────────────────────────────────────────────────────────────────────

export default function HygienePage() {
  const supabase = createClient()
  const { profile, isLoading: profileLoading } = useExchangeProfile()

  const userId = profile?.uid ?? null

  // ── 세탁 인증 필요 물품 조회 ─────────────────────────────────────────────
  const { data: hygieneItems = [], isLoading: itemsLoading } = useQuery<HygieneItem[]>({
    queryKey: ['hygiene-items', userId],
    enabled: !!userId,
    queryFn: async () => {
      // 셀러가 보유한 물품 중 세탁 인증 필요한 것
      const { data, error } = await supabase
        .from('package_listings')
        .select(`
          category_id,
          package_items!inner (
            requires_hygiene_cert
          ),
          categories (name)
        `)
        .eq('seller_uid', userId!)
        .eq('package_items.requires_hygiene_cert', true)

      if (error) throw new Error('물품 목록을 불러올 수 없어요')

      // category_id 중복 제거
      const seen = new Set<number>()
      return (data ?? [])
        .filter((row) => {
          if (seen.has(row.category_id)) return false
          seen.add(row.category_id)
          return true
        })
        .map((row) => {
          const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories
          return {
            category_id: row.category_id,
            category_name: (cat as { name: string } | null)?.name ?? '알 수 없음',
          }
        })
    },
  })

  // ── 현재 세탁 인증 상태 조회 ─────────────────────────────────────────────
  const { data: certs = [], isLoading: certsLoading } = useQuery<CertRecord[]>({
    queryKey: ['hygiene-certs', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hygiene_certifications')
        .select('cert_id, category_id, image_url, status')
        .eq('seller_uid', userId!)

      if (error) throw new Error('인증 정보를 불러올 수 없어요')
      return (data ?? []) as CertRecord[]
    },
  })

  const certMap = new Map(certs.map((c) => [c.category_id, c]))

  const isLoading = profileLoading || itemsLoading || certsLoading

  // ── 로딩 ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      </div>
    )
  }

  // ── mock 데이터 (미로그인 개발 미리보기) ────────────────────────────────
  const displayItems = !userId ? MOCK_HYGIENE_ITEMS : hygieneItems
  const displayCertMap = !userId
    ? new Map(MOCK_CERTS.map((c) => [c.category_id, c]))
    : certMap

  // ── 세탁 인증 필요 물품 없음 ─────────────────────────────────────────────
  if (!userId && displayItems.length === 0) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">
          교환학생 프로필이 필요해요.{' '}
          <Link href="/" className="underline">홈으로</Link>
        </p>
      </div>
    )
  }

  if (userId && hygieneItems.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/sell/register" className="text-sm text-gray-500 underline">← 등록으로</Link>
          <h1 className="text-xl font-bold">세탁 인증</h1>
        </div>
        <p className="text-sm text-gray-500">세탁 인증이 필요한 물품이 없어요.</p>
        <Link href="/packages" className="inline-block mt-4 px-4 py-2 bg-black text-white text-sm rounded">
          패키지 현황 보기
        </Link>
      </div>
    )
  }

  const displayIncompleteCount = Array.from(displayItems).filter((item) => {
    const cert = displayCertMap.get(item.category_id)
    return !cert || cert.status !== 'approved'
  }).length

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/sell/register" className="text-gray-400 text-sm">←</Link>
        <h1 className="text-lg font-bold">패키지 등록</h1>
      </div>

      <SellStepHeader current={3} />

      {!userId && (
        <div className="border border-yellow-300 bg-yellow-50 rounded p-2 mb-4">
          <p className="text-xs text-yellow-700">개발 미리보기 — 실제 데이터 아님</p>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-6">
        이불, 베개, 토퍼 등 몸에 닿는 물품은 세탁 완료 사진 업로드가 필수예요.
      </p>

      {/* 업로드 가이드 */}
      <div className="border border-gray-200 rounded p-3 mb-6 text-xs text-gray-600">
        <p className="font-medium mb-1">좋은 사진 예시</p>
        <ul className="list-disc list-inside space-y-0.5 text-gray-500">
          <li>세탁기 안에 물품이 들어있는 사진</li>
          <li>세탁 완료 후 건조 중인 사진</li>
          <li>세탁 라벨이 보이는 사진</li>
        </ul>
        <p className="mt-2 text-gray-400">허용 형식: JPG, PNG / 최대 10MB</p>
      </div>

      {/* 물품 목록 */}
      <div className="flex flex-col gap-3 mb-6">
        {displayItems.map((item) => (
          <HygieneItemRow
            key={item.category_id}
            item={item}
            cert={displayCertMap.get(item.category_id) ?? null}
            sellerUid={userId ?? 'mock-uid-preview'}
          />
        ))}
      </div>

      {/* 하단 요약 */}
      <div className="border-t border-gray-100 pt-4">
        {displayIncompleteCount > 0 ? (
          <>
            <p className="text-sm text-yellow-700 mb-1">
              미완료 물품 {displayIncompleteCount}개
            </p>
            <p className="text-xs text-gray-400 mb-3">
              모두 승인되어야 패키지 게시가 가능해요. 사진 업로드 후 관리자 검토를 기다려주세요.
            </p>
            <Link
              href="/packages"
              className="inline-block px-4 py-2 border border-gray-300 text-sm rounded text-gray-600"
            >
              일단 패키지 현황 보기
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-green-700 mb-3">
              모든 인증 완료 — 패키지 게시 가능해요 🎉
            </p>
            <Link
              href="/sell/register"
              className="inline-block px-4 py-2 bg-black text-white text-sm rounded"
            >
              돌아가서 게시하기
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock 데이터 (개발 미리보기)
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_HYGIENE_ITEMS: HygieneItem[] = [
  { category_id: 1, category_name: '이불' },
  { category_id: 2, category_name: '베개' },
  { category_id: 3, category_name: '토퍼' },
]

const MOCK_CERTS: CertRecord[] = [
  { cert_id: 1, category_id: 1, image_url: '', status: 'approved' },
  { cert_id: 2, category_id: 2, image_url: '', status: 'pending' },
]
