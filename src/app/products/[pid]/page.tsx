'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@lib/supabase/client'
import {
  getProductDetail,
  logProductView,
} from '@lib/queries/products'
import type {
  BookConditionData,
  DeviceConditionData,
  ProductDetail,
} from '@lib/queries/types'
import {
  BOOK_FIELDS,
  DEVICE_FIELDS,
  formatPrice,
} from '@lib/format'

/**
 * useParams 는 string | string[] | undefined 를 반환할 수 있어 정규화한다.
 * - 배열이면 첫 원소
 * - 빈 문자열/공백은 무효 (null)
 */
function normalizePid(raw: string | string[] | undefined): string | null {
  if (!raw) return null
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  return trimmed.length === 0 ? null : trimmed
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams<{ pid: string | string[] }>()
  const pid = normalizePid(params?.pid)

  const [authChecked, setAuthChecked] = useState(false)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imgIndex, setImgIndex] = useState(0)

  // 1) 마운트 시 1회: 인증 체크 (화면 3 와 동일 패턴)
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
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2) pid 변경 시: 매물 상세 재조회
  useEffect(() => {
    if (!authChecked) return
    if (!pid) {
      setLoading(false)
      setProduct(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setImgIndex(0)

    ;(async () => {
      try {
        const detail = await getProductDetail(pid)
        if (cancelled) return
        setProduct(detail)
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof Error ? e.message : '오류가 발생했어요',
        )
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authChecked, pid])

  // 3) 마운트 + pid 변경 시: 조회 로그 (fire-and-forget — await 없음)
  useEffect(() => {
    if (!authChecked || !pid) return
    void logProductView(pid)
  }, [authChecked, pid])

  function handleWishlist() {
    // TODO: 옆 팀 함수와 연결 예정
    alert('내일 옆 팀과 합칠 때 연결할 예정입니다')
  }

  function handleChat() {
    // TODO: 옆 팀 함수와 연결 예정
    alert('내일 옆 팀과 합칠 때 연결할 예정입니다')
  }

  if (!authChecked) {
    return (
      <div className="max-w-md mx-auto p-4">
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    )
  }

  if (!pid) {
    return (
      <ErrorView onBack={() => router.back()} message="잘못된 접근입니다" />
    )
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4">
        <p className="text-sm text-gray-500">매물 정보를 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorView onBack={() => router.back()} message="오류가 발생했어요" />
    )
  }

  if (!product) {
    return (
      <ErrorView
        onBack={() => router.back()}
        message="이 상품을 찾을 수 없어요"
      />
    )
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        ← 이전으로 돌아가기
      </button>

      <ImageSlider
        images={product.images}
        index={imgIndex}
        onIndexChange={setImgIndex}
      />

      <header className="flex items-center gap-2">
        <h1 className="text-xl font-semibold flex-1">{product.title}</h1>
        {product.status === 'reserved' && (
          <span className="rounded bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5">
            예약중
          </span>
        )}
        {product.status === 'sold' && (
          <span className="rounded bg-gray-200 text-gray-700 text-xs px-2 py-0.5">
            판매 완료
          </span>
        )}
      </header>

      <section className="border-t pt-4 space-y-1">
        <p className="text-sm text-gray-500">가격</p>
        <p className="text-2xl font-semibold">{formatPrice(product.price)}</p>
      </section>

      <section className="border-t pt-4 space-y-1">
        <p className="text-sm text-gray-500">설명</p>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">
          {product.description ?? '등록된 설명이 없어요.'}
        </p>
      </section>

      <section className="border-t pt-4 space-y-1">
        <p className="text-sm text-gray-500">거래 희망 장소</p>
        <p className="text-sm text-gray-800">학내 직거래</p>
        <p className="text-xs text-gray-500">(구체 장소는 채팅에서 협의)</p>
      </section>

      <section className="border-t pt-4 space-y-3">
        <p className="text-sm text-gray-500">상품 상태</p>
        {product.book_condition ? (
          <BookConditionList data={product.book_condition} />
        ) : product.device_condition ? (
          <DeviceConditionList data={product.device_condition} />
        ) : (
          <p className="text-sm text-gray-700">
            상품 상태 정보가 등록되지 않았어요
          </p>
        )}
      </section>

      <section className="border-t pt-4 space-y-1">
        <p className="text-sm text-gray-500">판매자</p>
        <p className="text-sm text-gray-800">
          {product.seller.nickname}{' '}
          <span className="text-gray-500">
            (매너 {Number(product.seller.manner_temperature).toFixed(1)}°C)
          </span>
        </p>
      </section>

      <div className="flex gap-2 border-t pt-4">
        <button
          type="button"
          onClick={handleWishlist}
          className="flex-1 rounded border border-gray-300 py-2 text-sm hover:bg-gray-50"
        >
          ♡ 찜하기
        </button>
        <button
          type="button"
          onClick={handleChat}
          className="flex-1 rounded bg-black text-white py-2 text-sm hover:bg-gray-800"
        >
          채팅하기
        </button>
      </div>
    </div>
  )
}

function ErrorView({
  onBack,
  message,
}: {
  onBack: () => void
  message: string
}) {
  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        ← 이전으로 돌아가기
      </button>
      <p className="text-sm text-gray-700">{message}</p>
    </div>
  )
}

/**
 * 이미지 슬라이더 — 라이브러리 없음, 순정 (overflow-x-auto + snap).
 *
 * - 각 슬라이드 w-full + snap-center 로 한 화면에 한 장씩 스냅
 * - scrollLeft / clientWidth 로 현재 인덱스 계산해 부모 state 동기화
 * - 이미지 0개면 placeholder, 1개면 인디케이터 숨김
 * - product.images 는 데이터 레이어에서 display_order ASC 정렬 보장 (Step 4-1)
 */
function ImageSlider({
  images,
  index,
  onIndexChange,
}: {
  images: { image_url: string; display_order: number }[]
  index: number
  onIndexChange: (i: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  function handleScroll() {
    const el = trackRef.current
    if (!el || el.clientWidth === 0) return
    const next = Math.round(el.scrollLeft / el.clientWidth)
    if (next !== index) onIndexChange(next)
  }

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded flex items-center justify-center text-sm text-gray-400">
        이미지 없음
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory rounded"
      >
        {images.map((img, i) => (
          <div
            key={`${img.image_url}-${i}`}
            className="snap-center shrink-0 w-full aspect-square bg-gray-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i === index ? 'bg-gray-900' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BookConditionList({ data }: { data: BookConditionData }) {
  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-gray-500">* 도서 한정 *</p>
      {BOOK_FIELDS.map((f) => {
        const selected = data[f.key]
        return (
          <div
            key={f.key}
            className="flex justify-between items-center text-sm"
          >
            <span className="text-gray-700">{f.label}</span>
            <span>
              {f.options.map((opt, i) => (
                <Fragment key={opt}>
                  {i > 0 && <span className="text-gray-300"> | </span>}
                  <span
                    className={
                      opt === selected
                        ? 'text-gray-900 font-medium'
                        : 'text-gray-300'
                    }
                  >
                    {(f.map as Record<string, string>)[opt]}
                  </span>
                </Fragment>
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function DeviceConditionList({ data }: { data: DeviceConditionData }) {
  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-gray-500">* 그 외 기기 *</p>
      {DEVICE_FIELDS.map((f) => {
        const selected = data[f.key]
        return (
          <div
            key={f.key}
            className="flex justify-between items-center text-sm"
          >
            <span className="text-gray-700">{f.label}</span>
            <span>
              {f.options.map((opt, i) => (
                <Fragment key={opt}>
                  {i > 0 && <span className="text-gray-300"> | </span>}
                  <span
                    className={
                      opt === selected
                        ? 'text-gray-900 font-medium'
                        : 'text-gray-300'
                    }
                  >
                    {(f.map as Record<string, string>)[opt]}
                  </span>
                </Fragment>
              ))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
