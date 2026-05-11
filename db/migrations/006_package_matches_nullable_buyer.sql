-- Migration 006: package_matches.buyer_uid nullable
-- Seller registers package before a buyer is matched.
-- buyer_uid is set when a buyer contacts the seller.

ALTER TABLE package_matches
    ALTER COLUMN buyer_uid DROP NOT NULL;

-- self-check constraint는 buyer_uid가 NULL이 아닐 때만 적용
ALTER TABLE package_matches
    DROP CONSTRAINT IF EXISTS chk_package_matches_no_self;

ALTER TABLE package_matches
    ADD CONSTRAINT chk_package_matches_no_self
        CHECK (buyer_uid IS NULL OR buyer_uid <> seller_uid);
