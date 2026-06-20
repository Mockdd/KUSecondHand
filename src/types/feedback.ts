// 데이터 플라이휠 관련 타입 정의.
// DB 스키마: db/migrations/014_data_flywheel.sql 와 1:1 매칭.

// ─── 모델 버전 ─────────────────────────────────────────────────

/**
 * 태그 예측 모델 버전.
 * predict API 는 is_active=true 인 행 1개를 사용.
 */
export interface ModelVersion {
  model_version_id: number
  version_label: string
  openai_model_id: string
  is_active: boolean
  precision_score: number | null
  recall_score: number | null
  sample_count: number | null
  notes: string | null
  created_at: string
}


// ─── 태그 피드백 로그 ──────────────────────────────────────────

/**
 * 사용자의 태그 수정 행동 로그.
 * - predicted_tags: 모델이 처음 제안한 태그
 * - final_tags    : 사용자가 최종 확정한 태그
 * - added_tags    : final - predicted (서버에서 계산 후 INSERT)
 * - removed_tags  : predicted - final (서버에서 계산 후 INSERT)
 */
export interface TagFeedbackLog {
  feedback_log_id: string                    // UUID
  user_id: string | null                     // soft delete 시 NULL
  product_id: string | null                  // 매물 삭제 시 NULL
  predicted_tags: string[]
  final_tags: string[]
  added_tags: string[]
  removed_tags: string[]
  model_version_id: number | null
  session_duration_ms: number | null
  created_at: string
}

/**
 * /api/tags/feedback POST 요청 바디.
 * added/removed 는 서버에서 계산하므로 클라이언트는 보내지 않음.
 */
export interface TagFeedbackRequest {
  productId: string
  predictedTags: string[]
  finalTags: string[]
  modelVersionId: number
  sessionDurationMs: number
}

export interface TagFeedbackResponse {
  success: boolean
  logId: string
}


// ─── 태그 예측 API ─────────────────────────────────────────────

export interface TagPredictRequest {
  imageUrl: string
  productId: string
}

export interface TagPredictResponse {
  tags: string[]
  modelVersionId: number
  modelLabel: string                         // 디버그/로깅용
  cached: boolean                            // 캐시 hit 여부
}


// ─── 캐시 (서버 내부 전용) ─────────────────────────────────────

/**
 * 캐시 테이블은 service_role 만 접근하므로 클라이언트에서 직접 쓸 일은 없음.
 * 백엔드 코드에서만 사용.
 */
export interface TagPredictionCache {
  image_url_hash: string                     // SHA-256 hex (64자)
  tags: string[]
  model_version_id: number | null
  created_at: string
  expires_at: string
}
