import { DEFAULT_MANNER_TEMPERATURE } from '@/lib/trust/constants'

/**
 * 받은 별점(리뷰 평점)만 사용해 매너 온도를 직접 계산합니다.
 * 1~5 평균을 0~100 선형 매핑 후 소수 둘째 자리까지 반올림합니다.
 */
export function ratingsToMannerTemperature(ratings: number[]): number {
  if (ratings.length === 0) return DEFAULT_MANNER_TEMPERATURE
  const sum = ratings.reduce((a, b) => a + b, 0)
  const avg = sum / ratings.length
  const mapped = ((avg - 1) / 4) * 100
  const clamped = Math.min(100, Math.max(0, mapped))
  return Math.round(clamped * 100) / 100
}
