/**
 * 패키지 추천 셀러 점수 계산 유틸리티
 *
 * 점수 공식 (feature_spec 기준):
 *   최종 점수 = 보유율 * 0.7 + 세탁인증 비율 * 0.3
 *
 * 방어 처리:
 *   - totalCount = 0 → 보유율 0.0
 *   - hygieneRequiredCount = 0 → 세탁인증 비율 1.0 (인증 필요 물품 없으면 만점)
 *   - 계산 결과는 항상 [0.0, 1.0] 범위로 clamp
 */

const OWNERSHIP_WEIGHT = 0.7
const HYGIENE_WEIGHT = 0.3

// ──────────────────────────────────────────────────────────────────────────────
// 점수 계산
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 셀러 최종 점수 계산
 *
 * @param ownedCount          셀러가 보유한 물품 수
 * @param totalCount          패키지 전체 물품 수
 * @param certifiedCount      세탁 인증 완료 물품 수 (approved)
 * @param hygieneRequiredCount 세탁 인증 필요 물품 수 (requires_hygiene_cert = true)
 * @returns 최종 점수 [0.0, 1.0]
 */
export const calculateSellerScore = (
  ownedCount: number,
  totalCount: number,
  certifiedCount: number,
  hygieneRequiredCount: number
): number => {
  const ownershipRate = totalCount > 0 ? ownedCount / totalCount : 0
  const certRate =
    hygieneRequiredCount > 0 ? certifiedCount / hygieneRequiredCount : 1.0

  const score = ownershipRate * OWNERSHIP_WEIGHT + certRate * HYGIENE_WEIGHT

  // 부동소수점 오차 방어: [0, 1] 범위 clamp
  return Math.min(1.0, Math.max(0.0, score))
}

/**
 * 보유율만 계산 (점수 바 표시용)
 *
 * @param ownedCount  보유 물품 수
 * @param totalCount  전체 물품 수
 * @returns 보유율 [0.0, 1.0]
 */
export const calculateOwnershipRate = (
  ownedCount: number,
  totalCount: number
): number => {
  if (totalCount <= 0) return 0
  return Math.min(1.0, Math.max(0.0, ownedCount / totalCount))
}

/**
 * 세탁 인증 비율만 계산 (배지 표시용)
 *
 * @param certifiedCount       인증 완료 수
 * @param hygieneRequiredCount 인증 필요 총수
 * @returns 인증 비율 [0.0, 1.0]
 */
export const calculateHygieneCertRate = (
  certifiedCount: number,
  hygieneRequiredCount: number
): number => {
  if (hygieneRequiredCount <= 0) return 1.0
  return Math.min(1.0, Math.max(0.0, certifiedCount / hygieneRequiredCount))
}

// ──────────────────────────────────────────────────────────────────────────────
// 동점 처리용 비교 함수
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 셀러 정렬용 비교 함수 (Array.sort에 직접 사용 가능)
 *
 * 정렬 우선순위:
 *   1. 최종 점수 높은 순
 *   2. 동점 시 보유율 높은 순
 *   3. 동점 시 세탁 인증 비율 높은 순
 *   4. 동점 시 match_id 작은 순 (등록일 오래된 순 — match_id는 자동증가)
 */
export interface SellerScoreInput {
  score: number
  ownership_rate: number
  hygiene_cert_rate: number
  match_id: number
}

export const compareSellerScore = (
  a: SellerScoreInput,
  b: SellerScoreInput
): number => {
  if (b.score !== a.score) return b.score - a.score
  if (b.ownership_rate !== a.ownership_rate)
    return b.ownership_rate - a.ownership_rate
  if (b.hygiene_cert_rate !== a.hygiene_cert_rate)
    return b.hygiene_cert_rate - a.hygiene_cert_rate
  return a.match_id - b.match_id
}
