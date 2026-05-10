import { TRUST_MIN_SATISFACTION_RATING } from '@/lib/trust/constants'

export type TransactionLike = {
  buyer_uid: string
  seller_uid: string
  status: string
}

export type ReviewEdge = {
  reviewer_uid: string
  reviewee_uid: string
  rating: number
}

/**
 * 완료된 거래이며, 구매자→판매자·판매자→구매자 리뷰가 각각 있고
 * 양쪽 별점이 최소 만족 기준 이상일 때만 성공 거래로 칩니다.
 */
export function isMutuallySatisfiedTransaction(
  tx: TransactionLike,
  reviews: ReviewEdge[],
  minRating: number = TRUST_MIN_SATISFACTION_RATING,
): boolean {
  if (tx.status !== 'completed') return false
  const b2s = reviews.find(
    (r) => r.reviewer_uid === tx.buyer_uid && r.reviewee_uid === tx.seller_uid,
  )
  const s2b = reviews.find(
    (r) => r.reviewer_uid === tx.seller_uid && r.reviewee_uid === tx.buyer_uid,
  )
  if (!b2s || !s2b) return false
  return b2s.rating >= minRating && s2b.rating >= minRating
}
