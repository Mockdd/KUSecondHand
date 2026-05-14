-- ============================================================
--  통합 마이그레이션: 002 ~ 007
--  Supabase SQL Editor에서 한 번에 실행
--  실행 순서: 002 → 003 → 004 → 005 → 006 → 007
-- ============================================================


-- ----------------------------------------------------------------
-- 002: 휴면·활동 추적 컬럼
-- ----------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dormant_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_activity_at IS '마지막 로그인 등 활동 시각';
COMMENT ON COLUMN users.dormant_at IS '휴면 전환 시각; NULL이면 비휴면';

CREATE INDEX IF NOT EXISTS idx_users_dormant ON users (dormant_at) WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------
-- 003: 성공 거래 수 캐시
-- ----------------------------------------------------------------
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
  '상태 completed 이고 구매자·판매자 상호 리뷰가 각각 최소 만족 별점 이상인 거래 수';


-- ----------------------------------------------------------------
-- 004: item_categories.category_id FK 추가 (시간표 추천 → 상품 보러가기)
-- ----------------------------------------------------------------
ALTER TABLE item_categories
  ADD COLUMN IF NOT EXISTS category_id INTEGER NULL;

DO $$
BEGIN
  ALTER TABLE item_categories
    ADD CONSTRAINT fk_item_categories_category
      FOREIGN KEY (category_id)
      REFERENCES categories (category_id)
      ON DELETE SET NULL
      ON UPDATE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_item_categories_category
  ON item_categories (category_id);

COMMENT ON COLUMN item_categories.category_id IS
  '연결된 상품 카테고리 ID (FK → categories). NULL이면 추천 결과의 [상품 보러가기] 버튼 비활성.';


-- ----------------------------------------------------------------
-- 005: essential_packages.country_code 추가
-- ----------------------------------------------------------------
ALTER TABLE essential_packages
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) NULL;

COMMENT ON COLUMN essential_packages.country_code IS
  'NULL이면 모든 국가 공통 템플릿. 지정 시 countries(country_code)와 매칭.';


-- ----------------------------------------------------------------
-- 006: package_matches.buyer_uid nullable 변경
-- ----------------------------------------------------------------
ALTER TABLE package_matches
  ALTER COLUMN buyer_uid DROP NOT NULL;

ALTER TABLE package_matches
  DROP CONSTRAINT IF EXISTS chk_package_matches_no_self;

ALTER TABLE package_matches
  ADD CONSTRAINT chk_package_matches_no_self
    CHECK (buyer_uid IS NULL OR buyer_uid <> seller_uid);


-- ----------------------------------------------------------------
-- 007: package_matches.price 컬럼 추가
-- ----------------------------------------------------------------
ALTER TABLE package_matches
  ADD COLUMN IF NOT EXISTS price INTEGER NULL;

COMMENT ON COLUMN package_matches.price IS '셀러가 제시한 패키지 총 가격 (원). NULL = 미설정';
