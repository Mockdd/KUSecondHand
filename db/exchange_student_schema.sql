-- ============================================================
--  교환학생 특화 기능 — Schema Extension
--  DBMS    : Supabase (PostgreSQL 15+)
--  작성일  : 2026-05-03
--  담당    : 교환학생 파트
--
--  [기존 schema.sql 뒤에 이어 붙여넣기]
--
--  [테이블 생성 순서 — FK 의존성 기준]
--    countries → exchange_students
--    → essential_packages → package_items
--    → package_matches → hygiene_certifications
--    → package_listings → exchange_wishlists
--
--  [기존 테이블 수정]
--    users         : onboarding_completed 컬럼 추가
--    chat_rooms    : package_match_id 컬럼 추가
--    chat_messages : original_text, translated_text, source_lang, target_lang 컬럼 추가
-- ============================================================

-- ============================================================
--  ENUM 추가
-- ============================================================

DO $$ BEGIN
    CREATE TYPE housing_type_t AS ENUM ('dorm', 'flat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE exchange_role_t AS ENUM ('incoming', 'outgoing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE match_status_t AS ENUM ('pending', 'matched', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE cert_status_t AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
--  1. countries  (국가 마스터)
--     정형 데이터 — 국가코드/지역그룹은 필터링에 사용되므로 정규 컬럼으로 분리
-- ============================================================

DROP TABLE IF EXISTS countries CASCADE;

CREATE TABLE countries (
    country_id      INTEGER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    country_code    VARCHAR(2)      NOT NULL,   -- ISO 3166-1 alpha-2
    name_ko         VARCHAR(100)    NOT NULL,
    name_en         VARCHAR(100)    NOT NULL,
    region_group    VARCHAR(50)     NOT NULL,   -- 예: 'EU', 'ASIA', 'AMERICAS' 등

    CONSTRAINT uq_countries_code UNIQUE (country_code)
);

COMMENT ON TABLE  countries              IS '국가 마스터 — ISO 코드 + 지역 그룹 매핑';
COMMENT ON COLUMN countries.country_code IS 'ISO 3166-1 alpha-2 (예: DE, JP, US)';
COMMENT ON COLUMN countries.region_group IS '패키지 추천 기준 지역 그룹 (예: EU, ASIA)';

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "countries: 전체 공개 읽기"
    ON countries FOR SELECT
    USING (true);

-- ============================================================
--  2. exchange_students  (교환학생 프로필 — users 1:1 확장)
--     정형 데이터 — 패키지 추천 필터링 기준이므로 정규 컬럼으로 분리
--     비정형 데이터(온보딩 추가 메모 등)는 metadata JSONB로 흡수
-- ============================================================

DROP TABLE IF EXISTS exchange_students CASCADE;

CREATE TABLE exchange_students (
    uid                     UUID            NOT NULL,
    country_id              INTEGER         NULL,
    region_group            VARCHAR(50)     NULL,       -- countries.region_group 비정규화 (조회 효율)
    housing_type            housing_type_t  NULL,       -- dorm | flat
    semester                VARCHAR(20)     NULL,       -- 예: '2026-1', '2026-2'
    language_pref           VARCHAR(10)     NOT NULL DEFAULT 'ko',  -- 예: 'ko', 'en', 'ja', 'zh'
    role                    exchange_role_t NULL,       -- incoming | outgoing
    onboarding_completed    BOOLEAN         NOT NULL DEFAULT FALSE,
    metadata                JSONB           NOT NULL DEFAULT '{}',  -- 비정형 추가 정보
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_exchange_students PRIMARY KEY (uid),
    CONSTRAINT fk_exchange_students_user
        FOREIGN KEY (uid)
        REFERENCES users (uid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_exchange_students_country
        FOREIGN KEY (country_id)
        REFERENCES countries (country_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
);

CREATE TRIGGER trg_exchange_students_updated_at
    BEFORE UPDATE ON exchange_students
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON TABLE  exchange_students                     IS '교환학생 프로필 — users 1:1 확장';
COMMENT ON COLUMN exchange_students.region_group        IS 'countries.region_group 비정규화 — 패키지 추천 필터 효율화';
COMMENT ON COLUMN exchange_students.semester            IS '체류 학기 (예: 2026-1)';
COMMENT ON COLUMN exchange_students.language_pref       IS 'UI 언어 설정 (ko/en/ja/zh)';
COMMENT ON COLUMN exchange_students.onboarding_completed IS '온보딩 4단계 완료 여부';
COMMENT ON COLUMN exchange_students.metadata            IS 'JSONB: 온보딩 추가 정보 등 비정형 데이터';

ALTER TABLE exchange_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_students: 본인 프로필 읽기/수정"
    ON exchange_students FOR ALL
    TO authenticated
    USING (uid = auth.uid())
    WITH CHECK (uid = auth.uid());

-- ============================================================
--  3. essential_packages  (패키지 템플릿 마스터)
--     정형 데이터 — region_group/housing_type은 추천 필터 기준
--     다국어 이름은 JSONB (비정형) 로 처리
-- ============================================================

DROP TABLE IF EXISTS essential_packages CASCADE;

CREATE TABLE essential_packages (
    package_id      INTEGER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_type   VARCHAR(50)     NOT NULL,   -- 예: 'DORM_BASIC', 'FLAT_FULL', 'INCOMING_DORM'
    name            JSONB           NOT NULL DEFAULT '{}',  -- { "ko": "기숙사 기본팩", "en": "Dorm Basic" }
    region_group    VARCHAR(50)     NULL,       -- NULL이면 모든 지역 적용
    housing_type    housing_type_t  NULL,       -- NULL이면 모든 거주형태 적용
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_essential_packages_type UNIQUE (template_type)
);

COMMENT ON TABLE  essential_packages              IS '패키지 템플릿 마스터 — 교환학생 필수 물품 묶음 정의';
COMMENT ON COLUMN essential_packages.template_type IS '템플릿 식별자 (예: DORM_BASIC, FLAT_FULL)';
COMMENT ON COLUMN essential_packages.name          IS 'JSONB 다국어 이름 { ko, en, ja, zh }';
COMMENT ON COLUMN essential_packages.region_group  IS 'NULL이면 전 지역 공통 템플릿';

ALTER TABLE essential_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "essential_packages: 전체 공개 읽기"
    ON essential_packages FOR SELECT
    USING (true);

-- ============================================================
--  4. package_items  (패키지 구성 물품)
--     패키지 템플릿에 어떤 카테고리 물품이 필요한지 정의
--     category_id → 기존 categories 테이블 재사용
-- ============================================================

DROP TABLE IF EXISTS package_items CASCADE;

CREATE TABLE package_items (
    package_item_id         INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    package_id              INTEGER     NOT NULL,
    category_id             INTEGER     NOT NULL,
    is_required             BOOLEAN     NOT NULL DEFAULT TRUE,
    priority_order          INTEGER     NOT NULL DEFAULT 0,
    requires_hygiene_cert   BOOLEAN     NOT NULL DEFAULT FALSE,  -- 세탁 인증 필요 여부 (이불 등)

    CONSTRAINT uq_package_items UNIQUE (package_id, category_id),
    CONSTRAINT fk_package_items_package
        FOREIGN KEY (package_id)
        REFERENCES essential_packages (package_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_items_category
        FOREIGN KEY (category_id)
        REFERENCES categories (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX idx_package_items_package ON package_items (package_id);

COMMENT ON TABLE  package_items                         IS '패키지 구성 물품 — essential_packages ↔ categories 연결';
COMMENT ON COLUMN package_items.requires_hygiene_cert   IS '세탁 인증 필요 물품 여부 (이불·베개·토퍼 등)';
COMMENT ON COLUMN package_items.priority_order          IS '물품 표시 순서 (낮을수록 우선)';

ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_items: 전체 공개 읽기"
    ON package_items FOR SELECT
    USING (true);

-- ============================================================
--  5. package_matches  (바이어-셀러 매칭)
--     교환학생 패키지 거래의 핵심 테이블
-- ============================================================

DROP TABLE IF EXISTS package_matches CASCADE;

CREATE TABLE package_matches (
    match_id        BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    package_id      INTEGER         NOT NULL,
    buyer_uid       UUID            NOT NULL,
    seller_uid      UUID            NOT NULL,
    status          match_status_t  NOT NULL DEFAULT 'pending',
    semester        VARCHAR(20)     NULL,       -- 거래 대상 학기
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_package_matches_no_self CHECK (buyer_uid <> seller_uid),
    CONSTRAINT fk_package_matches_package
        FOREIGN KEY (package_id)
        REFERENCES essential_packages (package_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_matches_buyer
        FOREIGN KEY (buyer_uid)
        REFERENCES users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_matches_seller
        FOREIGN KEY (seller_uid)
        REFERENCES users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE TRIGGER trg_package_matches_updated_at
    BEFORE UPDATE ON package_matches
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_package_matches_buyer  ON package_matches (buyer_uid);
CREATE INDEX idx_package_matches_seller ON package_matches (seller_uid);
CREATE INDEX idx_package_matches_status ON package_matches (status);

COMMENT ON TABLE  package_matches         IS '교환학생 패키지 바이어-셀러 매칭';
COMMENT ON COLUMN package_matches.status  IS 'ENUM match_status_t: pending | matched | completed | cancelled';
COMMENT ON COLUMN package_matches.semester IS '거래 대상 학기 (예: 2026-1)';

ALTER TABLE package_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_matches: 당사자만 읽기"
    ON package_matches FOR SELECT
    TO authenticated
    USING (buyer_uid = auth.uid() OR seller_uid = auth.uid());

CREATE POLICY "package_matches: 바이어 매칭 요청"
    ON package_matches FOR INSERT
    TO authenticated
    WITH CHECK (buyer_uid = auth.uid());

CREATE POLICY "package_matches: 당사자 상태 변경"
    ON package_matches FOR UPDATE
    TO authenticated
    USING (buyer_uid = auth.uid() OR seller_uid = auth.uid());

-- ============================================================
--  6. hygiene_certifications  (세탁 인증)
--     이불·베개·토퍼 등 requires_hygiene_cert = true 물품에 대한 인증
--     이미지는 Supabase Storage URL 참조 (비정형 데이터는 metadata JSONB로)
-- ============================================================

DROP TABLE IF EXISTS hygiene_certifications CASCADE;

CREATE TABLE hygiene_certifications (
    cert_id         BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    seller_uid      UUID            NOT NULL,
    category_id     INTEGER         NOT NULL,
    image_url       TEXT            NOT NULL,   -- Supabase Storage URL
    status          cert_status_t   NOT NULL DEFAULT 'pending',
    reviewed_at     TIMESTAMPTZ     NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_hygiene_cert_seller
        FOREIGN KEY (seller_uid)
        REFERENCES users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_hygiene_cert_category
        FOREIGN KEY (category_id)
        REFERENCES categories (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE TRIGGER trg_hygiene_certifications_updated_at
    BEFORE UPDATE ON hygiene_certifications
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_hygiene_cert_seller ON hygiene_certifications (seller_uid);

COMMENT ON TABLE  hygiene_certifications          IS '세탁 인증 — 이불·베개·토퍼 등 위생 필수 물품 인증';
COMMENT ON COLUMN hygiene_certifications.status   IS 'ENUM cert_status_t: pending | approved | rejected';
COMMENT ON COLUMN hygiene_certifications.image_url IS 'Supabase Storage URL — 세탁 완료 사진';

ALTER TABLE hygiene_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hygiene_certifications: 셀러 본인 읽기/등록"
    ON hygiene_certifications FOR ALL
    TO authenticated
    USING (seller_uid = auth.uid())
    WITH CHECK (seller_uid = auth.uid());

-- ============================================================
--  7. exchange_wishlists  (교환학생 알림 신청)
--     기존 wishlists(상품 기반)와 구조가 달라 별도 테이블로 분리
--     기존: pid(상품) 기반 / 교환학생: category_id(카테고리) + region_group 기반
-- ============================================================

DROP TABLE IF EXISTS exchange_wishlists CASCADE;

CREATE TABLE exchange_wishlists (
    exchange_wishlist_id    BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uid                     UUID        NOT NULL,
    category_id             INTEGER     NOT NULL,
    region_group            VARCHAR(50) NULL,
    semester                VARCHAR(20) NULL,
    is_notified             BOOLEAN     NOT NULL DEFAULT FALSE,
    notified_at             TIMESTAMPTZ NULL,
    deleted_at              TIMESTAMPTZ NULL,   -- Soft Delete
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_exchange_wishlists UNIQUE (uid, category_id, region_group, semester),
    CONSTRAINT fk_exchange_wishlists_user
        FOREIGN KEY (uid)
        REFERENCES users (uid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_exchange_wishlists_category
        FOREIGN KEY (category_id)
        REFERENCES categories (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX idx_exchange_wishlists_uid ON exchange_wishlists (uid) WHERE deleted_at IS NULL;

COMMENT ON TABLE  exchange_wishlists              IS '교환학생 알림 신청 — 카테고리+지역 기반 (기존 wishlists와 별도)';
COMMENT ON COLUMN exchange_wishlists.is_notified  IS '알림 발송 여부';
COMMENT ON COLUMN exchange_wishlists.deleted_at   IS 'Soft Delete — NULL이면 활성';

ALTER TABLE exchange_wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_wishlists: 본인만 접근"
    ON exchange_wishlists FOR ALL
    TO authenticated
    USING (uid = auth.uid() AND deleted_at IS NULL)
    WITH CHECK (uid = auth.uid());

-- ============================================================
--  9. 기존 테이블 컬럼 추가
--     ALTER TABLE — 기존 데이터에 영향 없이 컬럼만 추가
-- ============================================================

-- ── users: 교환학생 온보딩 완료 여부 ─────────────────────────
-- exchange_students 테이블이 있지만 users 레벨에서도 빠른 체크용
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.onboarding_completed IS '온보딩 완료 여부 — exchange_students 미가입자도 FALSE';

-- ── chat_rooms: 패키지 매칭 연결 ──────────────────────────────
-- 교환학생 패키지 거래 채팅방은 package_match_id로 연결
-- 일반 채팅방은 NULL (기존 기능 영향 없음)
ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS package_match_id BIGINT NULL;

ALTER TABLE chat_rooms
    ADD CONSTRAINT fk_chat_rooms_package_match
        FOREIGN KEY (package_match_id)
        REFERENCES package_matches (match_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT;

COMMENT ON COLUMN chat_rooms.package_match_id IS 'FK → package_matches — 교환학생 패키지 거래 채팅방 연결, 일반 채팅은 NULL';

-- ── chat_messages: 번역 채팅 지원 ────────────────────────────
-- original_text: 발신자가 입력한 원문
-- translated_text: DeepL API 번역 결과
-- 기존 data JSONB 필드는 그대로 유지 (기존 기능 영향 없음)
ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS original_text      TEXT        NULL,
    ADD COLUMN IF NOT EXISTS translated_text    TEXT        NULL,
    ADD COLUMN IF NOT EXISTS source_lang        VARCHAR(10) NULL,  -- 예: 'ko', 'en'
    ADD COLUMN IF NOT EXISTS target_lang        VARCHAR(10) NULL;  -- 예: 'en', 'ko'

COMMENT ON COLUMN chat_messages.original_text   IS '발신자 원문 — 번역 채팅 사용 시';
COMMENT ON COLUMN chat_messages.translated_text IS 'DeepL API 번역 결과 — 번역 실패 시 NULL';
COMMENT ON COLUMN chat_messages.source_lang     IS '원문 언어 코드 (예: ko)';
COMMENT ON COLUMN chat_messages.target_lang     IS '번역 대상 언어 코드 (예: en)';

-- ============================================================
--  SEED DATA — countries (주요 교환학생 출신 국가)
-- ============================================================

INSERT INTO countries (country_code, name_ko, name_en, region_group) VALUES
    ('KR', '대한민국',   'South Korea',  'ASIA'),
    ('JP', '일본',       'Japan',        'ASIA'),
    ('CN', '중국',       'China',        'ASIA'),
    ('DE', '독일',       'Germany',      'EU'),
    ('FR', '프랑스',     'France',       'EU'),
    ('US', '미국',       'United States','AMERICAS'),
    ('GB', '영국',       'United Kingdom','EU'),
    ('AU', '호주',       'Australia',    'OCEANIA'),
    ('CA', '캐나다',     'Canada',       'AMERICAS'),
    ('VN', '베트남',     'Vietnam',      'ASIA')
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================
--  SEED DATA — essential_packages (패키지 템플릿)
-- ============================================================

INSERT INTO essential_packages (template_type, name, region_group, housing_type) VALUES
    ('INCOMING_DORM', '{"ko": "기숙사 입주 패키지", "en": "Dorm Move-in Package"}', NULL, 'dorm'),
    ('INCOMING_FLAT', '{"ko": "자취 입주 패키지",   "en": "Flat Move-in Package"}',  NULL, 'flat'),
    ('OUTGOING_SELL', '{"ko": "귀국 전 판매 패키지","en": "Pre-departure Sale Package"}', NULL, NULL)
ON CONFLICT (template_type) DO NOTHING;

-- ============================================================
--  Supabase Realtime 활성화 (패키지 매칭 상태 실시간 반영)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE package_matches;

-- ============================================================
--  8. package_listings  (교환학생 패키지 전용 매물)
--     일반 products와 분리 — 교환학생 마켓 전용
--     "패키지 매물 보러가기" → 셀러에게 채팅 연결
-- ============================================================

DROP TABLE IF EXISTS package_listings CASCADE;

CREATE TABLE package_listings (
    listing_id      BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    match_id        BIGINT           NOT NULL,
    seller_uid      UUID             NOT NULL,
    category_id     INTEGER          NOT NULL,
    status          product_status_t NOT NULL DEFAULT 'selling',  -- 기존 ENUM 재사용
    semester        VARCHAR(20)      NULL,
    image_url       TEXT             NULL,    -- Supabase Storage URL
    cert_id         BIGINT           NULL,    -- FK → hygiene_certifications (NULL 가능)
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_package_listings_match
        FOREIGN KEY (match_id)
        REFERENCES package_matches (match_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_package_listings_seller
        FOREIGN KEY (seller_uid)
        REFERENCES users (uid)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_package_listings_category
        FOREIGN KEY (category_id)
        REFERENCES categories (category_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_package_listings_cert
        FOREIGN KEY (cert_id)
        REFERENCES hygiene_certifications (cert_id)
        ON DELETE SET NULL ON UPDATE RESTRICT
);

CREATE TRIGGER trg_package_listings_updated_at
    BEFORE UPDATE ON package_listings
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_package_listings_match  ON package_listings (match_id);
CREATE INDEX idx_package_listings_seller ON package_listings (seller_uid);
CREATE INDEX idx_package_listings_status ON package_listings (status);

COMMENT ON TABLE  package_listings           IS '교환학생 패키지 전용 매물 — 일반 products와 분리';
COMMENT ON COLUMN package_listings.status    IS 'ENUM product_status_t 재사용: selling | reserved | sold';
COMMENT ON COLUMN package_listings.cert_id   IS 'FK → hygiene_certifications — 세탁 인증 필요 물품에만 연결';
COMMENT ON COLUMN package_listings.image_url IS 'Supabase Storage URL';

ALTER TABLE package_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_listings: 인증 사용자 읽기"
    ON package_listings FOR SELECT TO authenticated USING (true);

CREATE POLICY "package_listings: 셀러 본인 등록"
    ON package_listings FOR INSERT TO authenticated
    WITH CHECK (seller_uid = auth.uid());

CREATE POLICY "package_listings: 셀러 본인 수정"
    ON package_listings FOR UPDATE TO authenticated
    USING (seller_uid = auth.uid())
    WITH CHECK (seller_uid = auth.uid());

-- ============================================================
--  Realtime 추가 (package_listings)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE package_listings;
