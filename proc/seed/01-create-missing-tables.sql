-- ============================================================
--  01-create-missing-tables.sql
--
--  대상: package_templates, package_template_items, resale_price_rules
--  방식: CREATE TABLE IF NOT EXISTS — 기존 테이블/데이터 영향 없음
--
--  실행 순서:
--    1) 이 파일 실행  (테이블 + 인덱스 + RLS 정책)
--    2) test-seed.sql 실행  (시드 데이터 삽입)
--
--  사전 조건 (이미 DB에 있어야 하는 것):
--    - majors 테이블
--    - categories 테이블
--    - housing_type_t ENUM  (교환학생 파트에서 정의)
--    - product_condition_t ENUM  (메인 파트에서 정의)
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
--  ENUM 안전 생성
--  schema.sql 의 어느 버전까지 적용됐는지 불확실하므로
--  누락 시에도 에러 없이 건너뜀
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE housing_type_t AS ENUM ('dorm', 'flat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE product_condition_t AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────
--  1. package_templates
--     의존성: majors (FK), housing_type_t (ENUM)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS package_templates (
    package_template_id BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title               VARCHAR(200)    NOT NULL,
    major_id            INTEGER         NULL,
    grade               SMALLINT        NULL,
    housing_type        housing_type_t  NULL,
    semester            VARCHAR(20)     NULL,
    description         TEXT            NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_package_templates_grade
        CHECK (grade IS NULL OR grade BETWEEN 1 AND 4),
    CONSTRAINT fk_package_templates_major
        FOREIGN KEY (major_id)
        REFERENCES majors (major_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_package_templates_filter
    ON package_templates (major_id, grade, housing_type, semester);

COMMENT ON TABLE  package_templates              IS '사용자 특성 기반 묶음 상품 패키지 템플릿';
COMMENT ON COLUMN package_templates.major_id     IS '특정 학과 대상 — NULL이면 전체 학과';
COMMENT ON COLUMN package_templates.grade        IS '특정 학년 대상 — NULL이면 전체 학년';
COMMENT ON COLUMN package_templates.housing_type IS '거주 형태 dorm | flat — NULL이면 전체';
COMMENT ON COLUMN package_templates.semester     IS '추천 대상 학기 — 예: 2026-1';

ALTER TABLE package_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "package_templates: 전체 공개 읽기"
        ON package_templates FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────
--  2. package_template_items
--     의존성: package_templates (FK + CASCADE), categories (FK)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS package_template_items (
    package_template_item_id BIGINT   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    package_template_id      BIGINT   NOT NULL,
    category_id              INTEGER  NOT NULL,
    required_quantity        INTEGER  NOT NULL DEFAULT 1,
    priority_order           INTEGER  NOT NULL DEFAULT 0,

    CONSTRAINT chk_package_template_items_quantity
        CHECK (required_quantity > 0),
    CONSTRAINT fk_package_template_items_template
        FOREIGN KEY (package_template_id)
        REFERENCES package_templates (package_template_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_template_items_category
        FOREIGN KEY (category_id)
        REFERENCES categories (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_package_template_items_template
    ON package_template_items (package_template_id);

CREATE INDEX IF NOT EXISTS idx_package_template_items_category
    ON package_template_items (category_id);

COMMENT ON TABLE  package_template_items                      IS '패키지 템플릿 구성 물품 — 기존 categories 참조';
COMMENT ON COLUMN package_template_items.category_id          IS '패키지에 포함될 실제 상품 카테고리';
COMMENT ON COLUMN package_template_items.required_quantity    IS '해당 카테고리 필요 수량';
COMMENT ON COLUMN package_template_items.priority_order       IS '패키지 내 표시 우선순위';

ALTER TABLE package_template_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "package_template_items: 전체 공개 읽기"
        ON package_template_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ──────────────────────────────────────────────────────────────
--  3. resale_price_rules
--     의존성: categories (FK, nullable), product_condition_t (ENUM)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS resale_price_rules (
    rule_id             BIGINT              GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id         INTEGER             NULL,
    condition           product_condition_t NULL,
    usage_months_min    INTEGER             NOT NULL DEFAULT 0,
    usage_months_max    INTEGER             NULL,
    depreciation_rate   NUMERIC(5,4)        NOT NULL,
    min_price_ratio     NUMERIC(5,4)        NOT NULL DEFAULT 0.1000,
    max_price_ratio     NUMERIC(5,4)        NOT NULL DEFAULT 1.0000,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_resale_price_rules_usage_min
        CHECK (usage_months_min >= 0),
    CONSTRAINT chk_resale_price_rules_usage_range
        CHECK (usage_months_max IS NULL OR usage_months_max >= usage_months_min),
    CONSTRAINT chk_resale_price_rules_depreciation
        CHECK (depreciation_rate BETWEEN 0 AND 1),
    CONSTRAINT chk_resale_price_rules_price_ratio
        CHECK (
            min_price_ratio BETWEEN 0 AND 1
            AND max_price_ratio BETWEEN 0 AND 1
            AND min_price_ratio <= max_price_ratio
        ),
    CONSTRAINT fk_resale_price_rules_category
        FOREIGN KEY (category_id)
        REFERENCES categories (category_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_resale_price_rules_filter
    ON resale_price_rules (category_id, condition, usage_months_min, usage_months_max);

COMMENT ON TABLE  resale_price_rules                  IS '재판매 가격 자동 설정 규칙';
COMMENT ON COLUMN resale_price_rules.category_id      IS '상품 카테고리별 가격 규칙 — NULL이면 전체 카테고리 기본 규칙';
COMMENT ON COLUMN resale_price_rules.condition        IS '상품 상태별 가격 규칙 — NULL이면 전체 상태 기본 규칙';
COMMENT ON COLUMN resale_price_rules.depreciation_rate IS '감가율 — 기존 거래가에서 차감할 비율';
COMMENT ON COLUMN resale_price_rules.min_price_ratio  IS '기존 거래가 대비 최소 추천 가격 비율';
COMMENT ON COLUMN resale_price_rules.max_price_ratio  IS '기존 거래가 대비 최대 추천 가격 비율';

ALTER TABLE resale_price_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "resale_price_rules: 전체 공개 읽기"
        ON resale_price_rules FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


COMMIT;

-- ──────────────────────────────────────────────────────────────
--  생성 확인 쿼리
-- ──────────────────────────────────────────────────────────────
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'package_templates',
--     'package_template_items',
--     'resale_price_rules'
--   );
