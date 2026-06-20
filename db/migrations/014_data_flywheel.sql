-- 014_data_flywheel.sql
-- 데이터 플라이휠 파이프라인 신규 테이블 + 인덱스 + 기본 시드
--
-- 추가되는 테이블:
--   1. model_versions        — 활성 모델 버전 관리 + 정확도 추적
--   2. tag_feedback_logs     — 사용자의 태그 수정 행동 로그 (학습용 정답 데이터)
--   3. tag_prediction_cache  — 동일 이미지 재예측 방지용 캐시 (TTL 24h)
--
-- 설계 메모:
--   - users 는 soft delete (deleted_at) 를 쓰므로 FK 도 SET NULL 로 통일.
--   - 학습 데이터(tag_feedback_logs) 는 사용자 탈퇴 후에도 익명화 형태로 보존.
--   - is_active 모델 유일성은 부분 유니크 인덱스로 보장.
--   - 부분 인덱스를 적극 사용하여 핵심 쿼리(학습 데이터 수집)를 최적화.
--
-- Supabase SQL Editor에서 1회 실행. RLS 정책은 별도 마이그레이션(015)에서 적용.

BEGIN;

-- ============================================================
-- 1. model_versions — 모델 버전 관리
-- ============================================================
-- predict API 는 is_active=true 인 모델을 사용.
-- 파인튜닝 완료 시 새 행 INSERT + 기존 is_active=true 를 FALSE 로 갱신 (트랜잭션).

CREATE TABLE IF NOT EXISTS model_versions (
    model_version_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    version_label       VARCHAR(100) NOT NULL,
    openai_model_id     VARCHAR(200) NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT FALSE,
    precision_score     NUMERIC(5, 4) NULL,
    recall_score        NUMERIC(5, 4) NULL,
    sample_count        INTEGER NULL,
    notes               TEXT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_model_versions_precision
        CHECK (precision_score IS NULL OR (precision_score >= 0 AND precision_score <= 1)),
    CONSTRAINT chk_model_versions_recall
        CHECK (recall_score IS NULL OR (recall_score >= 0 AND recall_score <= 1)),
    CONSTRAINT chk_model_versions_sample_count
        CHECK (sample_count IS NULL OR sample_count >= 0)
);

-- 활성 모델은 동시에 최대 1개만 존재하도록 강제
CREATE UNIQUE INDEX IF NOT EXISTS uq_model_versions_active
    ON model_versions (is_active)
    WHERE is_active = TRUE;

COMMENT ON TABLE  model_versions                    IS '태그 예측 모델 버전 관리 — predict API 는 is_active=true 한 행을 사용';
COMMENT ON COLUMN model_versions.openai_model_id    IS 'OpenAI 모델 식별자 (base 또는 fine-tuned 모델 ID)';
COMMENT ON COLUMN model_versions.precision_score    IS 'evaluate_model.py 에서 측정한 Precision (0~1)';
COMMENT ON COLUMN model_versions.recall_score       IS 'evaluate_model.py 에서 측정한 Recall (0~1)';
COMMENT ON COLUMN model_versions.sample_count       IS '이 모델 학습에 사용된 샘플 수';


-- ============================================================
-- 2. tag_feedback_logs — 사용자 태그 수정 로그 (학습 데이터)
-- ============================================================
-- 매물 등록 시 모델 제안 태그(predicted) vs 사용자 확정 태그(final) 기록.
-- added/removed 는 application(API) 측에서 계산 후 INSERT.
--
-- soft delete 정책에 맞춰:
--   - user_id: NULL 가능 + ON DELETE SET NULL (탈퇴 후에도 익명 학습 데이터로 보존)
--   - product_id: NULL 가능 + ON DELETE SET NULL (매물 삭제 후에도 로그 보존)

CREATE TABLE IF NOT EXISTS tag_feedback_logs (
    feedback_log_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NULL,
    product_id           UUID NULL,
    predicted_tags       TEXT[] NOT NULL DEFAULT '{}',
    final_tags           TEXT[] NOT NULL DEFAULT '{}',
    added_tags           TEXT[] NOT NULL DEFAULT '{}',
    removed_tags         TEXT[] NOT NULL DEFAULT '{}',
    model_version_id     BIGINT NULL,
    session_duration_ms  INTEGER NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tag_feedback_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users (uid)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,
    CONSTRAINT fk_tag_feedback_logs_product
        FOREIGN KEY (product_id)
        REFERENCES products (pid)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,
    CONSTRAINT fk_tag_feedback_logs_model
        FOREIGN KEY (model_version_id)
        REFERENCES model_versions (model_version_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,
    CONSTRAINT chk_tag_feedback_logs_session_ms
        CHECK (session_duration_ms IS NULL OR session_duration_ms >= 0)
);

-- 사용자별 조회 (마이페이지 / RLS 본인 데이터 SELECT)
-- user_id IS NULL (익명화된 로그) 은 인덱스 제외
CREATE INDEX IF NOT EXISTS idx_tag_feedback_logs_user
    ON tag_feedback_logs (user_id)
    WHERE user_id IS NOT NULL;

-- 학습 데이터 수집의 핵심 쿼리:
--   WHERE created_at > now() - interval '7 days'
--     AND (array_length(added_tags, 1) > 0 OR array_length(removed_tags, 1) > 0)
-- → 수정이 실제로 일어난 로그만 학습 데이터로 의미 있음. 부분 인덱스로 최적화.
CREATE INDEX IF NOT EXISTS idx_tag_feedback_logs_training
    ON tag_feedback_logs (created_at DESC)
    WHERE array_length(added_tags, 1) > 0
       OR array_length(removed_tags, 1) > 0;

-- 모델 버전별 분석 (정확도 추이, 버전별 피드백 수)
CREATE INDEX IF NOT EXISTS idx_tag_feedback_logs_model_version
    ON tag_feedback_logs (model_version_id)
    WHERE model_version_id IS NOT NULL;

COMMENT ON TABLE  tag_feedback_logs                  IS '사용자 태그 수정 행동 로그 — 학습 데이터의 원천';
COMMENT ON COLUMN tag_feedback_logs.predicted_tags   IS '모델이 처음 제안한 태그 (수정 전)';
COMMENT ON COLUMN tag_feedback_logs.final_tags       IS '사용자가 최종 확정한 태그';
COMMENT ON COLUMN tag_feedback_logs.added_tags       IS 'final - predicted (사용자가 추가한 태그)';
COMMENT ON COLUMN tag_feedback_logs.removed_tags     IS 'predicted - final (사용자가 삭제한 태그)';
COMMENT ON COLUMN tag_feedback_logs.session_duration_ms IS '태그 편집에 사용한 시간 (ms) — UX 분석용';


-- ============================================================
-- 3. tag_prediction_cache — 동일 이미지 재예측 방지 캐시
-- ============================================================
-- 같은 이미지를 짧은 시간 안에 여러 번 요청해도 OpenAI 비용이 폭발하지 않도록.
-- image_url_hash: 이미지 URL 의 SHA-256 hex 문자열 (앱 레이어에서 계산해 저장).
-- expires_at: 기본 TTL 24h. 조회 시 expires_at > NOW() 조건 필수.

CREATE TABLE IF NOT EXISTS tag_prediction_cache (
    image_url_hash      CHAR(64) PRIMARY KEY,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    model_version_id    BIGINT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',

    CONSTRAINT fk_tag_prediction_cache_model
        FOREIGN KEY (model_version_id)
        REFERENCES model_versions (model_version_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
);

-- 만료된 캐시 정리용 — pg_cron 또는 주기 배치에서 사용
CREATE INDEX IF NOT EXISTS idx_tag_prediction_cache_expires_at
    ON tag_prediction_cache (expires_at);

COMMENT ON TABLE  tag_prediction_cache                IS 'predict API 응답 캐시 (TTL 24h) — 동일 이미지 재호출 비용 방지';
COMMENT ON COLUMN tag_prediction_cache.image_url_hash IS '이미지 URL 의 SHA-256 hex 다이제스트 (64자) — 앱 레이어에서 계산';


-- ============================================================
-- 4. 기본 시드: 활성 모델 1개
-- ============================================================
-- predict API 가 model_versions WHERE is_active=true 를 항상 1개 찾도록 보장.
-- 파인튜닝 전 단계에서는 base GPT-4o-mini 가 활성 모델.

INSERT INTO model_versions (version_label, openai_model_id, is_active, notes)
SELECT 'baseline-v1', 'gpt-4o-mini', TRUE, '파인튜닝 전 기본 모델'
WHERE NOT EXISTS (SELECT 1 FROM model_versions WHERE is_active = TRUE);


COMMIT;


-- ============================================================
-- 검증 쿼리 (실행 후 결과 확인용)
-- ============================================================

-- 1) 신규 테이블 3개 존재 확인
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('tag_feedback_logs', 'model_versions', 'tag_prediction_cache')
-- ORDER BY table_name;

-- 2) 활성 모델 1개 존재 확인 (반드시 1행)
-- SELECT model_version_id, version_label, openai_model_id, is_active
-- FROM model_versions WHERE is_active = TRUE;

-- 3) 인덱스 5개 존재 확인 (model_versions 의 uq + tag_feedback_logs 3개 + tag_prediction_cache 1개)
-- SELECT tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('tag_feedback_logs', 'model_versions', 'tag_prediction_cache')
-- ORDER BY tablename, indexname;

-- 4) FK 제약 4개 존재 확인
-- SELECT conname, conrelid::regclass AS table_name
-- FROM pg_constraint
-- WHERE conname LIKE 'fk_tag_feedback_logs%'
--    OR conname LIKE 'fk_tag_prediction_cache%'
-- ORDER BY conname;
