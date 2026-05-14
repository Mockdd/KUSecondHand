-- 프로필: 거주 형태(기숙사/자취), 동아리(자유 입력)
-- housing_type 값은 exchange_students 등과 동일하게 dorm | flat

ALTER TABLE users ADD COLUMN IF NOT EXISTS club_name VARCHAR(200) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS housing_type TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_housing_type_vals'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_housing_type_vals
      CHECK (housing_type IS NULL OR housing_type IN ('dorm', 'flat'));
  END IF;
END $$;

COMMENT ON COLUMN users.club_name IS '동아리(자유 입력)';
COMMENT ON COLUMN users.housing_type IS '거주 형태 dorm=기숙사 flat=자취';
