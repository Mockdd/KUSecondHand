-- 성공 거래 수 캐시 (양쪽 만족 완료 거래, 구매·판매 역할 모두 집계)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS successful_trade_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE users
    ADD CONSTRAINT chk_users_successful_trade_count
    CHECK (successful_trade_count >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN users.successful_trade_count IS
  '상태 completed 이고 구매자·판매자 상호 리뷰가 각각 최소 만족 별점 이상인 거래 수(사용자 기준 중복 없이 거래 단위)';
