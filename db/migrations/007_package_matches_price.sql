-- Migration 007: package_matches.price
-- Seller sets a total package price when registering.

ALTER TABLE package_matches
    ADD COLUMN IF NOT EXISTS price INTEGER NULL;

COMMENT ON COLUMN package_matches.price IS '셀러가 제시한 패키지 총 가격 (원). NULL = 미설정';
