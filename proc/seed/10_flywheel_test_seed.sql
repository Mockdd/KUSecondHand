-- ============================================================
--  10_flywheel_test_seed.sql
--  데이터 플라이휠 E2E 테스트용 더미 피드백 데이터
--
--  목적:
--    실제 사용자 피드백 데이터가 충분히 쌓이기 전에
--    collect_training_data.py + run_finetune.py 파이프라인을
--    E2E 테스트할 수 있도록 더미 데이터를 삽입.
--
--  실행 조건:
--    - 014_data_flywheel.sql 이 먼저 실행돼 있어야 함
--    - products 테이블에 상품이 최소 1개 이상 있어야 함
--    - users 테이블에 사용자가 최소 1명 이상 있어야 함
--
--  실행 위치: Supabase SQL Editor
--  멱등: 재실행 시 기존 더미 데이터 삭제 후 재삽입
-- ============================================================

BEGIN;

-- ── 0. 클린업 (멱등 실행) ────────────────────────────────────────────────────
DELETE FROM tag_feedback_logs
WHERE product_id IN (
    SELECT pid FROM products
    WHERE title LIKE '[테스트]%'
);

-- ── 1. 테스트용 상품 + 피드백 로그 삽입 ─────────────────────────────────────
-- 실제 products.pid 와 users.uid 를 동적으로 참조하므로
-- 데이터가 없으면 INSERT 가 0건으로 스킵됨 (에러 없음).
--
-- 전략:
--   products 중 이미지가 있는 상품 최대 10개,
--   users 중 첫 번째 사용자를 기준으로 더미 피드백 생성.
--   added_tags / removed_tags 가 모두 비어있지 않아야
--   idx_tag_feedback_logs_training 인덱스를 타고
--   collect_training_data.py 가 수집함.

WITH
  sample_users AS (
      SELECT uid FROM users
      WHERE deleted_at IS NULL
      LIMIT 1
  ),
  sample_products AS (
      SELECT p.pid
      FROM products p
      JOIN product_images pi ON pi.pid = p.pid
      WHERE p.deleted_at IS NULL
        AND p.status = 'selling'
      LIMIT 10
  ),
  active_model AS (
      SELECT model_version_id FROM model_versions
      WHERE is_active = TRUE
      LIMIT 1
  )
INSERT INTO tag_feedback_logs (
    user_id,
    product_id,
    predicted_tags,
    final_tags,
    added_tags,
    removed_tags,
    model_version_id,
    session_duration_ms,
    created_at
)
SELECT
    u.uid,
    p.pid,
    -- 모델이 처음 제안한 태그 (일부러 틀린 태그 포함)
    ARRAY['중고', '상품', '저렴', '판매중', '랜덤태그'],
    -- 사용자가 최종 확정한 태그
    ARRAY['중고', '상품', '저렴', '좋은상태', '추천'],
    -- 사용자가 추가한 태그
    ARRAY['좋은상태', '추천'],
    -- 사용자가 삭제한 태그
    ARRAY['판매중', '랜덤태그'],
    m.model_version_id,
    -- 5~30초 사이 랜덤 편집 시간
    (5000 + floor(random() * 25000))::INTEGER,
    -- 최근 7일 내 랜덤 시각
    NOW() - (random() * INTERVAL '7 days')
FROM sample_products p
CROSS JOIN sample_users u
CROSS JOIN active_model m;

-- ── 2. 삽입 결과 확인 ────────────────────────────────────────────────────────
-- 검증 쿼리 (주석 해제 후 실행):
-- SELECT COUNT(*) AS dummy_count FROM tag_feedback_logs
-- WHERE removed_tags != '{}'
--   AND created_at > NOW() - INTERVAL '8 days';

COMMIT;


-- ============================================================
--  테스트 실행 순서
-- ============================================================
--
--  1. 이 SQL 실행 → 더미 피드백 N건 삽입 확인
--
--  2. collect_training_data.py 테스트:
--     python scripts/collect_training_data.py --dry-run
--     → "성공: N건" 메시지 확인 (N >= FINETUNE_MIN_SAMPLES 이어야 함)
--       N 이 50 미만이면 더미 상품을 더 추가하거나
--       FINETUNE_MIN_SAMPLES 를 낮춰서 테스트
--
--  3. run_finetune.py 테스트 (dry-run):
--     python scripts/run_finetune.py --dry-run
--     → OpenAI 호출 없이 데이터 수집까지만 확인
--
--  4. evaluate_model.py 테스트:
--     python scripts/evaluate_model.py --dry-run
--     → 활성 모델로 테스트 이미지 5장 예측 + 점수 출력
--
--  5. 더미 데이터 정리 (테스트 완료 후):
--     DELETE FROM tag_feedback_logs
--     WHERE session_duration_ms BETWEEN 5000 AND 30000
--       AND array_length(removed_tags, 1) > 0
--       AND created_at > NOW() - INTERVAL '8 days';
