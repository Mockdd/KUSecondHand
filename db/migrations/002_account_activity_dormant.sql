-- 휴면·활동 추적 (팀 DB에 적용 시 실행)
-- Supabase SQL Editor 또는 마이그레이션 파이프라인에서 1회 실행

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dormant_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_activity_at IS '마지막 로그인 등 활동 시각';
COMMENT ON COLUMN users.dormant_at IS '휴면 전환 시각; NULL이면 비휴면';

CREATE INDEX IF NOT EXISTS idx_users_dormant ON users (dormant_at) WHERE deleted_at IS NULL;
