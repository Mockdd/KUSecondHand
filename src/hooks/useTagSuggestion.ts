'use client'

import { useCallback, useRef, useState } from 'react'

import type {
  TagFeedbackRequest,
  TagFeedbackResponse,
  TagPredictRequest,
  TagPredictResponse,
} from '@/types/feedback'

const PREDICT_TIMEOUT_MS = 10_000

type TagSuggestionState = {
  predictedTags: string[]
  tags: string[]
  modelVersionId: number | null
  modelLabel: string | null
  cached: boolean
  loading: boolean
  submitting: boolean
  error: string | null
  startedAt: number | null
}

type PredictParams = TagPredictRequest

type SubmitFeedbackParams = {
  productId: string
  finalTags: string[]
}

async function readError(response: Response, fallback: string): Promise<string> {
  const json = await response.json().catch(() => null) as { error?: string } | null
  return json?.error ?? fallback
}

export function useTagSuggestion() {
  const abortRef = useRef<AbortController | null>(null)
  const [state, setState] = useState<TagSuggestionState>({
    predictedTags: [],
    tags: [],
    modelVersionId: null,
    modelLabel: null,
    cached: false,
    loading: false,
    submitting: false,
    error: null,
    startedAt: null,
  })

  const predict = useCallback(async ({ imageUrl, productId }: PredictParams) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), PREDICT_TIMEOUT_MS)

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      startedAt: Date.now(),
    }))

    try {
      const response = await fetch('/api/tags/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, productId }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(await readError(response, '태그 자동 추출에 실패했습니다.'))
      }

      const data = await response.json() as TagPredictResponse
      setState((prev) => ({
        ...prev,
        predictedTags: data.tags,
        tags: data.tags,
        modelVersionId: data.modelVersionId,
        modelLabel: data.modelLabel,
        cached: data.cached,
        loading: false,
        error: null,
      }))
      return data
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? '태그 자동 추출 시간이 초과되었습니다.'
          : err instanceof Error
            ? err.message
            : '태그 자동 추출에 실패했습니다.'

      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }))
      throw new Error(message)
    } finally {
      window.clearTimeout(timeoutId)
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [])

  const setTags = useCallback((tags: string[]) => {
    setState((prev) => ({ ...prev, tags }))
  }, [])

  const submitFeedback = useCallback(async ({ productId, finalTags }: SubmitFeedbackParams) => {
    const startedAt = state.startedAt ?? Date.now()
    const modelVersionId = state.modelVersionId ?? 0
    const body: TagFeedbackRequest = {
      productId,
      predictedTags: state.predictedTags,
      finalTags,
      modelVersionId,
      sessionDurationMs: Date.now() - startedAt,
    }

    setState((prev) => ({ ...prev, submitting: true, error: null }))

    try {
      const response = await fetch('/api/tags/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(await readError(response, '태그 피드백 저장에 실패했습니다.'))
      }

      return await response.json() as TagFeedbackResponse
    } catch (err) {
      const message = err instanceof Error ? err.message : '태그 피드백 저장에 실패했습니다.'
      setState((prev) => ({ ...prev, error: message }))
      throw new Error(message)
    } finally {
      setState((prev) => ({ ...prev, submitting: false }))
    }
  }, [state.modelVersionId, state.predictedTags, state.startedAt])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState({
      predictedTags: [],
      tags: [],
      modelVersionId: null,
      modelLabel: null,
      cached: false,
      loading: false,
      submitting: false,
      error: null,
      startedAt: null,
    })
  }, [])

  return {
    ...state,
    predict,
    setTags,
    submitFeedback,
    reset,
  }
}
