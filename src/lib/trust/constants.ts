/** 양쪽 모두 이 별점 이상이면 ‘만족’으로 간주 */
export const TRUST_MIN_SATISFACTION_RATING = 4

/** 신뢰 뱃지: 성공 거래가 이 횟수 이상 */
export const TRUST_BADGE_MIN_SUCCESSFUL_TRADES = 2

/** 받은 리뷰가 없을 때 매너 온도 기본값 */
export const DEFAULT_MANNER_TEMPERATURE = 36.5

export function isTrustedSeller(successfulTradeCount: number | null | undefined): boolean {
  return (successfulTradeCount ?? 0) >= TRUST_BADGE_MIN_SUCCESSFUL_TRADES
}
