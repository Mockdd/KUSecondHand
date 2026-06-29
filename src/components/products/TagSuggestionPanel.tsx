'use client'

import type { KeyboardEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { useTagSuggestion } from '@/hooks/useTagSuggestion'

const MAX_TAGS = 10

type TagSuggestionPanelProps = {
  imageUrl: string
  productId: string
  onTagsConfirmed: (tags: string[]) => void
  onFeedbackSubmitted?: (logId: string) => void
  submitFeedbackOnConfirm?: boolean
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ')
}

export default function TagSuggestionPanel({
  imageUrl,
  productId,
  onTagsConfirmed,
  onFeedbackSubmitted,
  submitFeedbackOnConfirm = false,
}: TagSuggestionPanelProps) {
  const {
    tags,
    loading,
    submitting,
    error,
    predict,
    setTags,
    submitFeedback,
    reset,
  } = useTagSuggestion()
  const [input, setInput] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const canAdd = useMemo(() => tags.length < MAX_TAGS, [tags.length])

  useEffect(() => {
    if (!imageUrl || !productId) {
      reset()
      setConfirmed(false)
      return
    }

    setConfirmed(false)
    predict({ imageUrl, productId }).catch(() => {
      // 에러 메시지는 훅 상태로 노출하고, 사용자는 수동 태그 입력을 계속할 수 있다.
    })
  }, [imageUrl, productId, predict, reset])

  function addTag(rawTag: string) {
    if (confirmed) return
    const tag = normalizeTag(rawTag)
    setLocalError(null)

    if (!tag) return
    if (tag.length > 30) {
      setLocalError('태그는 30자 이하로 입력해주세요.')
      return
    }
    if (tags.includes(tag)) {
      setInput('')
      return
    }
    if (!canAdd) {
      setLocalError(`태그는 최대 ${MAX_TAGS}개까지 추가할 수 있습니다.`)
      return
    }

    setTags([...tags, tag])
    setInput('')
  }

  function removeTag(tag: string) {
    if (confirmed) return
    setLocalError(null)
    setTags(tags.filter((item) => item !== tag))
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTag(input)
      return
    }

    if (event.key === 'Backspace' && !input && tags.length > 0) {
      setTags(tags.slice(0, -1))
    }
  }

  async function handleConfirm() {
    if (confirmed) return

    setLocalError(null)
    onTagsConfirmed(tags)
    setConfirmed(true)

    if (!submitFeedbackOnConfirm) return

    try {
      const result = await submitFeedback({ productId, finalTags: tags })
      onFeedbackSubmitted?.(result.logId)
    } catch {
      // 피드백 실패는 확정 UX를 막지 않는다.
      setConfirmed(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">AI 태그 제안</h2>
        {loading && <span className="text-xs text-gray-500">분석 중...</span>}
      </div>

      <div className="flex min-h-10 flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-3 text-sm text-indigo-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={confirmed}
              className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800 disabled:opacity-40"
              aria-label={`${tag} 태그 삭제`}
            >
              x
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleInputKeyDown}
          disabled={!canAdd || confirmed}
          maxLength={30}
          placeholder={canAdd ? '태그 추가' : '태그 최대 개수 도달'}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          type="button"
          onClick={() => addTag(input)}
          disabled={!canAdd || !input.trim() || confirmed}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50"
        >
          추가
        </button>
      </div>

      {(error || localError) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {localError ?? error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading || submitting || confirmed}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {confirmed ? '확정 완료' : submitting ? '저장 중...' : '태그 확정'}
        </button>
      </div>
    </section>
  )
}
