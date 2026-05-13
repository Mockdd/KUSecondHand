'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Category = { category_id: number; parent_id: number | null; name: string }
type Tab = 'product' | 'package'

const CONDITION_OPTIONS = [
  { value: 'new',      label: '새 상품' },
  { value: 'like_new', label: '거의 새것' },
  { value: 'good',     label: '상태 양호' },
  { value: 'fair',     label: '보통' },
  { value: 'poor',     label: '하자 있음' },
]

function NewProductPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('product')

  const [title, setTitle] = useState('')
  const [price, setPrice] = useState(searchParams.get('price') ?? '')
  const [condition, setCondition] = useState('')
  const [selectedParent, setSelectedParent] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories')
      const json = await res.json() as { categories: Category[] }
      return json.categories ?? []
    },
    staleTime: Infinity,
  })

  const parentCategories = categories.filter((c) => c.parent_id === null)
  const childCategories = categories.filter((c) => c.parent_id === Number(selectedParent))

  // 소분류 없는 대분류 선택 시 자동으로 categoryId 설정
  useEffect(() => {
    if (!selectedParent) { setCategoryId(''); return }
    const hasChildren = categories.some((c) => c.parent_id === Number(selectedParent))
    if (!hasChildren) setCategoryId(selectedParent)
    else setCategoryId('')
  }, [selectedParent, categories])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const valid = files.filter((f) => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024)
    if (valid.length !== files.length) setError('이미지 파일만, 파일당 10MB 이하로 선택해주세요.')
    const next = [...imageFiles, ...valid].slice(0, 5)
    setImageFiles(next)
    valid.forEach((f) => {
      const url = URL.createObjectURL(f)
      setPreviews((prev) => [...prev, url].slice(0, 5))
    })
  }

  function removeImage(idx: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) return setError('제목을 입력해주세요.')
    if (!price || Number(price) < 0) return setError('올바른 가격을 입력해주세요.')
    if (!condition) return setError('상품 상태를 선택해주세요.')
    if (!categoryId) return setError('카테고리를 선택해주세요.')

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다.')

      const imageUrls: string[] = []
      for (const file of imageFiles) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('products')
          .upload(path, file, { cacheControl: '3600', upsert: false })
        if (upErr) throw new Error(`이미지 업로드 실패: ${upErr.message}`)
        const { data: pub } = supabase.storage.from('products').getPublicUrl(path)
        imageUrls.push(pub.publicUrl)
      }

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          price: Number(price),
          condition,
          category_id: Number(categoryId),
          description: description.trim() || undefined,
          image_urls: imageUrls,
        }),
      })

      const json = await res.json() as { pid?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? '등록에 실패했습니다.')
      router.push(`/products/${json.pid}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">상품 등록</h1>

      {/* 탭 */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setTab('product')}
          className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
            tab === 'product' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          일반 상품
        </button>
        <button
          onClick={() => router.push('/sell/template')}
          className="rounded-lg px-5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          패키지
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">

          {/* 이미지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이미지 <span className="text-gray-400 font-normal">(최대 5장 · 장당 10MB 이하)</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {previews.map((src, i) => (
                <div key={i} className="relative h-24 w-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white text-xs hover:bg-black/70"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {previews.length < 5 && (
                <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-2xl text-gray-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors">
                  +
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="상품 제목을 입력하세요"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-400 text-right">{title.length}/200</p>
          </div>

          {/* 가격 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              가격 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-8 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              적정 가격을 모르시나요?{' '}
              <Link href="/recommend/resale-price" className="text-[#8B0029] hover:underline">
                시세 추천 확인 →
              </Link>
            </p>
          </div>

          {/* 상태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 상태 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CONDITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCondition(opt.value)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    condition === opt.value
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-300 text-gray-700 hover:border-indigo-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={selectedParent}
                onChange={(e) => setSelectedParent(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">대분류 선택</option>
                {parentCategories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                ))}
              </select>
              {childCategories.length > 0 && (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">소분류 선택</option>
                  {childCategories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="상품 상태, 구매 시기, 하자 여부 등을 자세히 적어주세요"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={uploading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {uploading ? '등록 중...' : '등록하기'}
          </button>
        </form>
    </div>
  )
}

export default function NewProductPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">상품 등록</h1>
          <p className="text-sm text-gray-500">불러오는 중…</p>
        </div>
      }
    >
      <NewProductPageInner />
    </Suspense>
  )
}
