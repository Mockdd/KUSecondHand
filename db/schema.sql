-- ============================================================
--  대학 중고거래 플랫폼 — Database Schema  (Supabase / PostgreSQL 15+)
-- ============================================================
--  DBMS    : Supabase (PostgreSQL 15+)
--  작성일  : 2026-05-01
--  참조    : tableSpec.md / platformDataDoc.md / ERD.jpg
-- ============================================================
--
--  [Supabase 실행 방법]
--    방법 1 — Dashboard SQL Editor:
--      Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행.
--
--    방법 2 — Supabase CLI 마이그레이션 (권장):
--      1) supabase init  (최초 1회)
--      2) 이 파일을 supabase/migrations/20260501000000_init.sql 로 복사
--      3) supabase db push  (원격) 또는  supabase db reset  (로컬)
--
--    방법 3 — psql 직접 연결:
--      psql "<Supabase Connection String>" -f schema.sql
--
--  [주의사항]
--    - DROP TABLE ... CASCADE 구문이 포함되어 있어 개발/초기화 용도에 적합.
--      운영 환경에서는 해당 구문을 제거하거나 supabase migration 으로 관리할 것.
--    - 인증은 Supabase Auth 가 담당 → users.password_hash 컬럼 없음.
--    - auth.users 에 새 사용자 가입 시 fn_on_auth_user_created() 트리거가
--      public.users 프로필 행을 자동 생성함.
--
--  [테이블 생성 순서 — FK 의존성 기준]
--    regions → users → categories → products → product_images
--    → wishlists → chat_rooms → chat_participants → chat_messages
--    → transactions → reviews → manner_keywords → review_keywords
--    → reports → report_evidences → user_penalties → audit_logs
--    → (Materialized View) mv_popular_products
-- ============================================================

BEGIN;  -- 전체 DDL 을 트랜잭션으로 래핑 — 오류 시 전체 롤백

-- ============================================================
--  0. 확장 (Supabase 기본 활성화 확인)
--     Supabase 는 pgcrypto, uuid-ossp 를 기본 제공.
--     gen_random_uuid() 는 PostgreSQL 13+ 에서 내장 함수로 사용 가능.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid() 보장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4() 대안 제공
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- 유사 문자열 검색 (자동완성, 오타 허용)
CREATE EXTENSION IF NOT EXISTS "pg_cron";    -- Materialized View 주기적 갱신 스케줄러

-- ============================================================
--  1. ENUM 타입 정의
--     ALTER TYPE ... ADD VALUE 로 값 추가 가능 (단, 삭제는 불가).
-- ============================================================

DO $$ BEGIN
    CREATE TYPE product_condition_t  AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE product_status_t     AS ENUM ('selling', 'reserved', 'sold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status_t AS ENUM ('pending', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE penalty_type_t       AS ENUM ('warning', 'suspend', 'ban');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
--  2. updated_at 자동 갱신 트리거 함수
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- ============================================================
--  3. Supabase Auth 연동 트리거 함수
--     auth.users 에 새 계정 생성 시 public.users 프로필을 자동 생성.
--     nickname / student_id / school_domain 은 가입 시 raw_user_meta_data 에서 추출.
--     예) supabase.auth.signUp({ email, password, options: { data: { nickname, student_id, school_domain } } })
-- ============================================================

CREATE OR REPLACE FUNCTION fn_on_auth_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (uid, email, nickname, student_id, school_domain)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nickname',     'user_' || LEFT(NEW.id::TEXT, 8)),
        COALESCE(NEW.raw_user_meta_data->>'student_id',   ''),
        COALESCE(NEW.raw_user_meta_data->>'school_domain','')
    )
    ON CONFLICT (uid) DO NOTHING;
    RETURN NEW;
END;
$$;

-- auth.users INSERT 시 트리거 등록
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION fn_on_auth_user_created();

-- ============================================================
--  4. regions
-- ============================================================

DROP TABLE IF EXISTS regions CASCADE;

CREATE TABLE regions (
    region_id   INTEGER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL,

    CONSTRAINT uq_regions_name UNIQUE (name)
);

COMMENT ON TABLE  regions           IS '지역 마스터 — 정밀 좌표 대신 지역 ID 사용';
COMMENT ON COLUMN regions.region_id IS '지역 ID (PK, Auto Identity)';
COMMENT ON COLUMN regions.name      IS '지역명';

-- RLS
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regions: 인증 사용자 읽기 허용"
    ON regions FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================
--  5. users  (Supabase Auth 연동 프로필 테이블)
--     - uid 는 auth.users(id) 를 참조 → Supabase Auth 가 인증 담당
--     - password_hash 제거 (인증은 Supabase Auth 위임)
--     - 회원가입 시 fn_on_auth_user_created 트리거가 행 자동 생성
-- ============================================================

DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    uid                 UUID            NOT NULL DEFAULT gen_random_uuid(),
    email               VARCHAR(255)    NOT NULL,
    nickname            VARCHAR(50)     NOT NULL,
    student_id          VARCHAR(20)     NOT NULL DEFAULT '',
    school_domain       VARCHAR(100)    NOT NULL DEFAULT '',
    profile_image_url   TEXT            NULL,
    bio                 TEXT            NULL,
    preferred_region_id INTEGER         NULL,
    joined_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    manner_temperature  NUMERIC(5,2)    NOT NULL DEFAULT 36.50,
    trade_count         INTEGER         NOT NULL DEFAULT 0,
    is_suspended        BOOLEAN         NOT NULL DEFAULT FALSE,
    warning_count       INTEGER         NOT NULL DEFAULT 0,
    deleted_at          TIMESTAMPTZ     NULL,
    onboarding_completed BOOLEAN        NOT NULL DEFAULT FALSE,  -- 교환학생 온보딩 완료 여부

    CONSTRAINT pk_users                PRIMARY KEY (uid),
    CONSTRAINT uq_users_email          UNIQUE      (email),
    CONSTRAINT uq_users_nickname       UNIQUE      (nickname),
    CONSTRAINT chk_users_manner        CHECK       (manner_temperature BETWEEN 0 AND 100),
    CONSTRAINT chk_users_trade_count   CHECK       (trade_count   >= 0),
    CONSTRAINT chk_users_warning_count CHECK       (warning_count >= 0),
    CONSTRAINT fk_users_auth
        FOREIGN KEY (uid)
        REFERENCES  auth.users (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_users_region
        FOREIGN KEY (preferred_region_id)
        REFERENCES  regions (region_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
);

CREATE INDEX idx_users_active_email    ON users (email)    WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active_nickname ON users (nickname) WHERE deleted_at IS NULL;

COMMENT ON TABLE  users                    IS '플랫폼 회원 프로필 — auth.users 연동, Soft Delete(deleted_at) 적용';
COMMENT ON COLUMN users.uid                IS 'auth.users(id) 참조 UUID (PK) — Supabase Auth 계정과 1:1';
COMMENT ON COLUMN users.email              IS '학교 이메일 (PII — 앱 레이어 암호화 권장)';
COMMENT ON COLUMN users.student_id         IS '학번 (PII — 앱 레이어 암호화 권장)';
COMMENT ON COLUMN users.school_domain      IS '학교 도메인 예: snu.ac.kr';
COMMENT ON COLUMN users.manner_temperature IS '매너 온도 0.00~100.00, 기본값 36.50';
COMMENT ON COLUMN users.is_suspended       IS '이용 정지 여부 (TRUE=정지)';
COMMENT ON COLUMN users.deleted_at         IS 'Soft Delete 시각 — NULL 이면 활성 계정';

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: 인증 사용자 프로필 읽기"
    ON users FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL);

CREATE POLICY "users: 본인 프로필 삽입"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (uid = auth.uid());

CREATE POLICY "users: 본인 프로필 수정"
    ON users FOR UPDATE
    TO authenticated
    USING (uid = auth.uid() AND deleted_at IS NULL)
    WITH CHECK (uid = auth.uid());

-- ============================================================
--  6. categories
-- ============================================================

DROP TABLE IF EXISTS categories CASCADE;

CREATE TABLE categories (
    category_id INTEGER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id   INTEGER         NULL,
    name        VARCHAR(100)    NOT NULL,

    CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_id)
        REFERENCES  categories (category_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
);

COMMENT ON TABLE  categories           IS '상품 카테고리 — parent_id 자기 참조로 계층 구조';
COMMENT ON COLUMN categories.parent_id IS 'FK → categories(category_id), 최상위면 NULL';

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories: 전체 공개 읽기"
    ON categories FOR SELECT
    USING (true);

-- ============================================================
--  7. products
-- ============================================================

DROP TABLE IF EXISTS products CASCADE;

CREATE TABLE products (
    pid         UUID                    NOT NULL DEFAULT gen_random_uuid(),
    seller_uid  UUID                    NOT NULL,
    category_id INTEGER                 NOT NULL,
    title       VARCHAR(200)            NOT NULL,
    price       INTEGER                 NOT NULL,
    condition   product_condition_t     NOT NULL,
    description TEXT                    NULL,
    status      product_status_t        NOT NULL DEFAULT 'selling',
    view_count  INTEGER                 NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ             NULL,

    CONSTRAINT pk_products        PRIMARY KEY (pid),
    CONSTRAINT chk_products_price CHECK (price >= 0),
    CONSTRAINT fk_products_seller
        FOREIGN KEY (seller_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES  categories (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_products_active_created ON products (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_active_seller  ON products (seller_uid)      WHERE deleted_at IS NULL;
CREATE INDEX idx_products_active_status  ON products (status)          WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category       ON products (category_id);

COMMENT ON TABLE  products             IS '판매 상품 — Soft Delete(deleted_at) 적용';
COMMENT ON COLUMN products.pid         IS '상품 UUID (PK)';
COMMENT ON COLUMN products.price       IS '현재 게시 가격(원) — 거래 시점 가격은 transactions.agreed_price 참조';
COMMENT ON COLUMN products.condition   IS 'ENUM product_condition_t: new | like_new | good | fair | poor';
COMMENT ON COLUMN products.status      IS 'ENUM product_status_t: selling | reserved | sold';
COMMENT ON COLUMN products.view_count  IS '상품 조회수 — Redis 없이 PostgreSQL 에서 직접 관리';
COMMENT ON COLUMN products.updated_at  IS '최종 수정 시각 — trg_products_updated_at 트리거로 자동 갱신';
COMMENT ON COLUMN products.deleted_at  IS 'Soft Delete 시각 — NULL 이면 공개 게시물';

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products: 활성 상품 전체 공개 읽기"
    ON products FOR SELECT
    USING (deleted_at IS NULL);

CREATE POLICY "products: 인증 사용자 상품 등록"
    ON products FOR INSERT
    TO authenticated
    WITH CHECK (seller_uid = auth.uid());

CREATE POLICY "products: 판매자 본인 상품 수정"
    ON products FOR UPDATE
    TO authenticated
    USING (seller_uid = auth.uid() AND deleted_at IS NULL)
    WITH CHECK (seller_uid = auth.uid());

-- Full-Text Search 인덱스 (pg_trgm 기반 — 한국어 포함 유사 검색)
-- to_tsvector 'simple' 설정은 언어 무관 토큰화 (한국어 형태소는 앱 레이어 전처리 권장)
CREATE INDEX idx_products_fts_title
    ON products USING GIN (to_tsvector('simple', title))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_products_fts_desc
    ON products USING GIN (to_tsvector('simple', COALESCE(description, '')))
    WHERE deleted_at IS NULL;

-- pg_trgm: 자동완성·오타 허용 검색 (SIMILARITY 함수 활용)
CREATE INDEX idx_products_trgm_title
    ON products USING GIN (title gin_trgm_ops)
    WHERE deleted_at IS NULL;

-- ============================================================
--  8. product_images
-- ============================================================

DROP TABLE IF EXISTS product_images CASCADE;

CREATE TABLE product_images (
    image_id        BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pid             UUID    NOT NULL,
    image_url       TEXT    NOT NULL,
    display_order   INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT chk_product_images_order CHECK (display_order >= 0),
    CONSTRAINT fk_product_images_product
        FOREIGN KEY (pid)
        REFERENCES  products (pid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
);

CREATE INDEX idx_product_images_pid ON product_images (pid);

COMMENT ON TABLE  product_images               IS '상품 이미지 — Supabase Storage URL 참조';
COMMENT ON COLUMN product_images.display_order IS '이미지 표시 순서 (0부터 시작)';

-- RLS
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_images: 전체 공개 읽기"
    ON product_images FOR SELECT
    USING (true);

CREATE POLICY "product_images: 판매자 본인 상품 이미지 등록"
    ON product_images FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM products p
            WHERE p.pid = product_images.pid
              AND p.seller_uid = auth.uid()
        )
    );

CREATE POLICY "product_images: 판매자 본인 상품 이미지 삭제"
    ON product_images FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM products p
            WHERE p.pid = product_images.pid
              AND p.seller_uid = auth.uid()
        )
    );

-- ============================================================
--  9. wishlists
-- ============================================================

DROP TABLE IF EXISTS wishlists CASCADE;

CREATE TABLE wishlists (
    wishlist_id BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uid         UUID        NOT NULL,
    pid         UUID        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wishlists_user_product UNIQUE (uid, pid),
    CONSTRAINT fk_wishlists_user
        FOREIGN KEY (uid)
        REFERENCES  users (uid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_wishlists_product
        FOREIGN KEY (pid)
        REFERENCES  products (pid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
);

COMMENT ON TABLE wishlists IS '찜 목록 — users ↔ products M:N 중간 테이블';

-- RLS
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlists: 본인 찜 목록만 접근"
    ON wishlists FOR ALL
    TO authenticated
    USING (uid = auth.uid())
    WITH CHECK (uid = auth.uid());

-- ============================================================
--  10. chat_rooms
-- ============================================================

DROP TABLE IF EXISTS chat_rooms CASCADE;

CREATE TABLE chat_rooms (
    room_id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id        UUID        NULL,        -- 일반 채팅방 (교환학생 채팅은 NULL)
    package_match_id  BIGINT      NULL,        -- 교환학생 패키지 채팅방 (일반 채팅은 NULL)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_chat_rooms_product
        FOREIGN KEY (product_id)
        REFERENCES  products (pid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
    -- fk_chat_rooms_package_match 는 package_matches 생성 후 추가
);

CREATE INDEX idx_chat_rooms_product ON chat_rooms (product_id);

COMMENT ON TABLE  chat_rooms                  IS '채팅방 — 일반(product_id) 또는 교환학생 패키지(package_match_id)';
COMMENT ON COLUMN chat_rooms.product_id       IS '일반 채팅방 연결 상품 — 교환학생 채팅은 NULL';
COMMENT ON COLUMN chat_rooms.package_match_id IS '교환학생 패키지 매칭 연결 — 일반 채팅은 NULL';

-- RLS
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_rooms: 참여 중인 채팅방만 읽기"
    ON chat_rooms FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_participants cp
            WHERE cp.room_id = chat_rooms.room_id
              AND cp.uid = auth.uid()
        )
    );

CREATE POLICY "chat_rooms: 인증 사용자 채팅방 생성"
    ON chat_rooms FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================
--  11. chat_participants
--      last_read_at: 읽음 확인 기능
-- ============================================================

DROP TABLE IF EXISTS chat_participants CASCADE;

CREATE TABLE chat_participants (
    cp_id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id         BIGINT      NOT NULL,
    uid             UUID        NOT NULL,
    last_read_at    TIMESTAMPTZ NULL,

    CONSTRAINT uq_chat_participants UNIQUE (room_id, uid),
    CONSTRAINT fk_chat_participants_room
        FOREIGN KEY (room_id)
        REFERENCES  chat_rooms (room_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_chat_participants_user
        FOREIGN KEY (uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

COMMENT ON TABLE  chat_participants              IS '채팅방 참여자';
COMMENT ON COLUMN chat_participants.last_read_at IS '마지막 읽음 시각 — NULL 이면 한 번도 읽지 않음';

-- RLS
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_participants: 같은 방 참여자만 읽기"
    ON chat_participants FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_participants cp
            WHERE cp.room_id = chat_participants.room_id
              AND cp.uid = auth.uid()
        )
    );

CREATE POLICY "chat_participants: 본인 참여 정보 추가"
    ON chat_participants FOR INSERT
    TO authenticated
    WITH CHECK (uid = auth.uid());

CREATE POLICY "chat_participants: 본인 읽음 시각 갱신"
    ON chat_participants FOR UPDATE
    TO authenticated
    USING (uid = auth.uid())
    WITH CHECK (uid = auth.uid());

-- ============================================================
--  12. transactions
--      - agreed_price: 거래 확정 시점 가격 스냅샷
--      - buyer_uid ≠ seller_uid: CHECK 로 자기 거래 방지
-- ============================================================

DROP TABLE IF EXISTS transactions CASCADE;

CREATE TABLE transactions (
    transaction_id  BIGINT                  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pid             UUID                    NOT NULL,
    buyer_uid       UUID                    NOT NULL,
    seller_uid      UUID                    NOT NULL,
    agreed_price    INTEGER                 NOT NULL,
    status          transaction_status_t    NOT NULL DEFAULT 'pending',
    completed_at    TIMESTAMPTZ             NULL,

    CONSTRAINT chk_transactions_price   CHECK (agreed_price >= 0),
    CONSTRAINT chk_transactions_no_self CHECK (buyer_uid <> seller_uid),
    CONSTRAINT fk_transactions_product
        FOREIGN KEY (pid)
        REFERENCES  products (pid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_transactions_buyer
        FOREIGN KEY (buyer_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_transactions_seller
        FOREIGN KEY (seller_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX idx_transactions_buyer  ON transactions (buyer_uid);
CREATE INDEX idx_transactions_seller ON transactions (seller_uid);
CREATE INDEX idx_transactions_pid    ON transactions (pid);

COMMENT ON TABLE  transactions              IS '거래 내역 — ACID 보장 필수';
COMMENT ON COLUMN transactions.agreed_price IS '거래 확정 가격 스냅샷 — products.price 변경과 무관';
COMMENT ON COLUMN transactions.status       IS 'ENUM transaction_status_t: pending | completed | cancelled';

-- RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: 구매자 또는 판매자만 읽기"
    ON transactions FOR SELECT
    TO authenticated
    USING (buyer_uid = auth.uid() OR seller_uid = auth.uid());

CREATE POLICY "transactions: 구매자 거래 생성"
    ON transactions FOR INSERT
    TO authenticated
    WITH CHECK (buyer_uid = auth.uid());

CREATE POLICY "transactions: 관련 당사자 상태 변경"
    ON transactions FOR UPDATE
    TO authenticated
    USING (buyer_uid = auth.uid() OR seller_uid = auth.uid());

-- ============================================================
--  13. reviews
--      UNIQUE (transaction_id, reviewer_uid): 동일 거래 중복 후기 방지
-- ============================================================

DROP TABLE IF EXISTS reviews CASCADE;

CREATE TABLE reviews (
    review_id       BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_id  BIGINT      NOT NULL,
    reviewer_uid    UUID        NOT NULL,
    reviewee_uid    UUID        NOT NULL,
    rating          SMALLINT    NOT NULL,
    content         TEXT        NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_reviews_per_transaction UNIQUE (transaction_id, reviewer_uid),
    CONSTRAINT chk_reviews_rating         CHECK  (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_reviews_no_self        CHECK  (reviewer_uid <> reviewee_uid),
    CONSTRAINT fk_reviews_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES  transactions (transaction_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_reviews_reviewer
        FOREIGN KEY (reviewer_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_reviews_reviewee
        FOREIGN KEY (reviewee_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX idx_reviews_reviewee ON reviews (reviewee_uid);

COMMENT ON TABLE  reviews        IS '거래 후기 — 거래당 작성자 1인 1건';
COMMENT ON COLUMN reviews.rating IS '별점 1~5';

-- RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews: 전체 공개 읽기"
    ON reviews FOR SELECT
    USING (true);

CREATE POLICY "reviews: 거래 당사자 후기 작성"
    ON reviews FOR INSERT
    TO authenticated
    WITH CHECK (
        reviewer_uid = auth.uid()
        AND EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.transaction_id = reviews.transaction_id
              AND (t.buyer_uid = auth.uid() OR t.seller_uid = auth.uid())
              AND t.status = 'completed'
        )
    );

-- ============================================================
--  14. manner_keywords
-- ============================================================

DROP TABLE IF EXISTS manner_keywords CASCADE;

CREATE TABLE manner_keywords (
    keyword_id  INTEGER         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    label       VARCHAR(100)    NOT NULL,

    CONSTRAINT uq_manner_keywords_label UNIQUE (label)
);

COMMENT ON TABLE manner_keywords IS '매너 키워드 마스터 — 관리자 사전 정의';

-- RLS
ALTER TABLE manner_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manner_keywords: 전체 공개 읽기"
    ON manner_keywords FOR SELECT
    USING (true);

-- ============================================================
--  15. review_keywords
--      reviews ↔ manner_keywords M:N 중간 테이블
-- ============================================================

DROP TABLE IF EXISTS review_keywords CASCADE;

CREATE TABLE review_keywords (
    review_id   BIGINT  NOT NULL,
    keyword_id  INTEGER NOT NULL,

    CONSTRAINT pk_review_keywords PRIMARY KEY (review_id, keyword_id),
    CONSTRAINT fk_review_keywords_review
        FOREIGN KEY (review_id)
        REFERENCES  reviews (review_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_review_keywords_keyword
        FOREIGN KEY (keyword_id)
        REFERENCES  manner_keywords (keyword_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

COMMENT ON TABLE review_keywords IS '후기-매너키워드 연결 (M:N) — 복합 PK';

-- RLS
ALTER TABLE review_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_keywords: 전체 공개 읽기"
    ON review_keywords FOR SELECT
    USING (true);

CREATE POLICY "review_keywords: 후기 작성자 키워드 등록"
    ON review_keywords FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reviews r
            WHERE r.review_id = review_keywords.review_id
              AND r.reviewer_uid = auth.uid()
        )
    );

-- ============================================================
--  16. reports
--      - reporter ≠ target: 자기 신고 방지 CHECK
--      - 법적 증거 자료로 물리 삭제 금지
-- ============================================================

DROP TABLE IF EXISTS reports CASCADE;

CREATE TABLE reports (
    report_id       BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporter_uid    UUID            NOT NULL,
    target_uid      UUID            NOT NULL,
    reason          VARCHAR(255)    NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_reports_no_self CHECK (reporter_uid <> target_uid),
    CONSTRAINT fk_reports_reporter
        FOREIGN KEY (reporter_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_reports_target
        FOREIGN KEY (target_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX idx_reports_target          ON reports (target_uid);
CREATE INDEX idx_reports_reporter_target ON reports (reporter_uid, target_uid);

COMMENT ON TABLE  reports              IS '신고 내역 — 법적 증거 자료로 물리 삭제 금지';
COMMENT ON COLUMN reports.reporter_uid IS '신고자 UUID — 앱 레이어에서 익명 처리, DB에는 기록 유지';

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports: 신고자 본인 신고 내역 읽기"
    ON reports FOR SELECT
    TO authenticated
    USING (reporter_uid = auth.uid());

CREATE POLICY "reports: 인증 사용자 신고 등록"
    ON reports FOR INSERT
    TO authenticated
    WITH CHECK (reporter_uid = auth.uid());

-- ============================================================
--  17. report_evidences
-- ============================================================

DROP TABLE IF EXISTS report_evidences CASCADE;

CREATE TABLE report_evidences (
    evidence_id BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id   BIGINT  NOT NULL,
    image_url   TEXT    NOT NULL,

    CONSTRAINT fk_report_evidences_report
        FOREIGN KEY (report_id)
        REFERENCES  reports (report_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT
);

CREATE INDEX idx_report_evidences_report ON report_evidences (report_id);

COMMENT ON TABLE report_evidences IS '신고 증거 이미지 — Supabase Storage URL 참조';

-- RLS
ALTER TABLE report_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_evidences: 신고자 본인만 읽기/등록"
    ON report_evidences FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM reports r
            WHERE r.report_id = report_evidences.report_id
              AND r.reporter_uid = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reports r
            WHERE r.report_id = report_evidences.report_id
              AND r.reporter_uid = auth.uid()
        )
    );

-- ============================================================
--  18. user_penalties
--      expires_at = NULL → 영구 제재(ban)
--      법적 증거 자료로서 물리 삭제 금지
-- ============================================================

DROP TABLE IF EXISTS user_penalties CASCADE;

CREATE TABLE user_penalties (
    penalty_id  BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uid         UUID            NOT NULL,
    type        penalty_type_t  NOT NULL,
    issued_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ     NULL,

    CONSTRAINT fk_user_penalties_user
        FOREIGN KEY (uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX idx_user_penalties_uid ON user_penalties (uid);

COMMENT ON TABLE  user_penalties            IS '사용자 제재 이력 — 물리 삭제 금지, 법적 증거 자료';
COMMENT ON COLUMN user_penalties.type       IS 'ENUM penalty_type_t: warning | suspend | ban';
COMMENT ON COLUMN user_penalties.expires_at IS '제재 만료 시각 — NULL 이면 영구 정지(ban)';

-- RLS
ALTER TABLE user_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_penalties: 본인 제재 이력 읽기"
    ON user_penalties FOR SELECT
    TO authenticated
    USING (uid = auth.uid());

-- ============================================================
--  19. chat_messages  (MongoDB 대체 — JSONB 하이브리드 구조)
--      - room_id / sender_uid / created_at : 컬럼 (필터·JOIN 대상)
--      - type / content / image_url / is_deleted : JSONB data 필드
--      - last_read_at 비교: ChatParticipant.last_read_at < created_at
--        → 안 읽은 메시지 수 산출
-- ============================================================

DROP TABLE IF EXISTS chat_messages CASCADE;

CREATE TABLE chat_messages (
    id               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id          BIGINT      NOT NULL,
    sender_uid       UUID        NOT NULL,
    data             JSONB       NOT NULL DEFAULT '{}',
    -- 교환학생 파트 추가: 번역 채팅
    original_text    TEXT        NULL,    -- 발신자 원문
    translated_text  TEXT        NULL,    -- DeepL 번역 결과 (실패 시 NULL)
    source_lang      VARCHAR(10) NULL,    -- 원문 언어 (예: 'ko')
    target_lang      VARCHAR(10) NULL,    -- 번역 대상 언어 (예: 'en')
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_chat_messages_type CHECK (
        data->>'type' IN ('text', 'image', 'system')
    ),
    CONSTRAINT fk_chat_messages_room
        FOREIGN KEY (room_id)
        REFERENCES  chat_rooms (room_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_chat_messages_sender
        FOREIGN KEY (sender_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

-- 채팅방별 시간순 조회 (가장 빈번한 쿼리 패턴)
CREATE INDEX idx_chat_messages_room_created ON chat_messages (room_id, created_at DESC);
-- JSONB 내부 필드 검색 (메시지 내용 검색 등)
CREATE INDEX idx_chat_messages_data ON chat_messages USING GIN (data);

COMMENT ON TABLE  chat_messages            IS '채팅 메시지 — MongoDB 대체, JSONB 하이브리드 구조';
COMMENT ON COLUMN chat_messages.data       IS 'JSONB: { type, content, image_url, is_deleted } — type: text|image|system';
COMMENT ON COLUMN chat_messages.created_at IS '전송 시각 — ChatParticipant.last_read_at 과 비교해 미읽음 수 산출';

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages: 채팅방 참여자만 읽기"
    ON chat_messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_participants cp
            WHERE cp.room_id = chat_messages.room_id
              AND cp.uid = auth.uid()
        )
    );

CREATE POLICY "chat_messages: 채팅방 참여자 메시지 전송"
    ON chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_uid = auth.uid()
        AND EXISTS (
            SELECT 1 FROM chat_participants cp
            WHERE cp.room_id = chat_messages.room_id
              AND cp.uid = auth.uid()
        )
    );

CREATE POLICY "chat_messages: 발신자 본인 메시지 수정(Soft Delete)"
    ON chat_messages FOR UPDATE
    TO authenticated
    USING (sender_uid = auth.uid())
    WITH CHECK (sender_uid = auth.uid());

-- ============================================================
--  20. audit_logs  (감사 로그 — 파티셔닝으로 대용량 처리)
--      - 월별 RANGE 파티셔닝 (created_at 기준)
--      - 물리 삭제 금지 (법적 증거 자료)
--      - RLS 없음 — 서비스 계정(service_role)만 접근
-- ============================================================

DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY,
    uid         UUID        NULL,
    action      VARCHAR(100) NOT NULL,
    ip_address  INET        NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- 초기 파티션 (2026년)
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE audit_logs_default  PARTITION OF audit_logs DEFAULT;

CREATE INDEX idx_audit_logs_uid        ON audit_logs (uid)        WHERE uid IS NOT NULL;
CREATE INDEX idx_audit_logs_action     ON audit_logs (action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);

COMMENT ON TABLE  audit_logs            IS '감사 로그 — 월별 파티셔닝, service_role 전용, 물리 삭제 금지';
COMMENT ON COLUMN audit_logs.action     IS '이벤트 유형: LOGIN | SIGNUP | REPORT | PENALTY | PRODUCT_DELETE 등';
COMMENT ON COLUMN audit_logs.ip_address IS 'PostgreSQL INET 타입 — IPv4/IPv6 모두 지원';
COMMENT ON COLUMN audit_logs.metadata  IS 'JSONB: 이벤트별 컨텍스트 (device, user_agent, target_uid 등)';

-- ============================================================
--  21. Supabase Realtime 활성화
--      채팅 관련 테이블에 Realtime 구독을 활성화.
--      클라이언트: supabase.channel('...').on('postgres_changes', ...) 으로 구독.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ============================================================
--  22. mv_popular_products  (인기 상품 Materialized View)
--      - view_count + wishlist 수 + 최신성 합산 점수로 랭킹 산출
--      - pg_cron 으로 1시간마다 자동 갱신 (Supabase 대시보드에서 활성화 필요)
--      - 클라이언트는 products 테이블 대신 이 뷰를 SELECT 하면 됨
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_popular_products;

CREATE MATERIALIZED VIEW mv_popular_products AS
SELECT
    p.pid,
    p.title,
    p.price,
    p.condition,
    p.status,
    p.view_count,
    p.created_at,
    p.seller_uid,
    p.category_id,
    COUNT(w.wishlist_id)                            AS wish_count,
    -- 점수: 조회수 가중 1.0 + 찜 수 가중 3.0 + 최신성(7일 기준 감쇠)
    (
        p.view_count * 1.0
        + COUNT(w.wishlist_id) * 3.0
        + GREATEST(0, 7 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400) * 2.0
    )                                               AS score
FROM products p
LEFT JOIN wishlists w ON w.pid = p.pid
WHERE p.deleted_at IS NULL
  AND p.status = 'selling'
GROUP BY p.pid
ORDER BY score DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_mv_popular_products_pid ON mv_popular_products (pid);

COMMENT ON MATERIALIZED VIEW mv_popular_products
    IS '인기 상품 TOP 100 — view_count·wish_count·최신성 합산 점수, pg_cron 1시간 갱신';

-- pg_cron 갱신 스케줄 등록 (Supabase 대시보드 > Extensions > pg_cron 활성화 후 실행)
-- SELECT cron.schedule(
--     'refresh-popular-products',
--     '0 * * * *',   -- 매시 정각
--     'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_popular_products'
-- );

-- ============================================================
--  SEED DATA
-- ============================================================

-- ── Seed: regions ─────────────────────────────────────────────
INSERT INTO regions (name) VALUES
    ('학교 근처'),
    ('기숙사'),
    ('캠퍼스 내'),
    ('시내'),
    ('온라인 택배');

-- ── Seed: categories (CTE + RETURNING 으로 계층 한 번에 삽입) ─
WITH top_level AS (
    INSERT INTO categories (parent_id, name) VALUES
        (NULL, '전자기기'),
        (NULL, '도서/교재'),
        (NULL, '의류/잡화'),
        (NULL, '생활용품'),
        (NULL, '식품/음료'),
        (NULL, '기타')
    RETURNING category_id, name
)
INSERT INTO categories (parent_id, name)
SELECT t.category_id, sub.name
FROM (VALUES
    ('전자기기',  '스마트폰'),
    ('전자기기',  '노트북/태블릿'),
    ('전자기기',  '이어폰/헤드폰'),
    ('전자기기',  '카메라'),
    ('도서/교재', '전공 교재'),
    ('도서/교재', '일반 도서'),
    ('도서/교재', '문제집/참고서'),
    ('의류/잡화', '상의'),
    ('의류/잡화', '하의'),
    ('의류/잡화', '가방/지갑'),
    ('생활용품',  '가구/인테리어'),
    ('생활용품',  '주방용품'),
    ('생활용품',  '청소/세탁')
) AS sub(parent_name, name)
JOIN top_level t ON t.name = sub.parent_name;

-- ── Seed: manner_keywords ──────────────────────────────────────
INSERT INTO manner_keywords (label) VALUES
    ('시간을 잘 지켜요'),
    ('친절하고 매너가 좋아요'),
    ('응답이 빨라요'),
    ('상품 설명이 정확해요'),
    ('상품 상태가 설명과 같아요'),
    ('제품을 깔끔하게 포장해줬어요'),
    ('거래 장소를 잘 지켜요'),
    ('흥정이 무리 없어요'),
    ('좋은 상품을 저렴하게 판매해요'),
    ('또 거래하고 싶어요');

-- ============================================================
--  [교환학생 파트] ENUM 추가
-- ============================================================

DO $$ BEGIN
    CREATE TYPE housing_type_t  AS ENUM ('dorm', 'flat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE exchange_role_t AS ENUM ('incoming', 'outgoing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE match_status_t  AS ENUM ('pending', 'matched', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE cert_status_t   AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
--  [교환학생 파트] 23. countries  (국가/지역 마스터)
--     기획안 기준 23개 지역 그룹 코드 사용
--     정형 데이터 — 패키지 추천 필터 기준
-- ============================================================

DROP TABLE IF EXISTS countries CASCADE;

CREATE TABLE countries (
    country_id    INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    country_code  VARCHAR(10)  NOT NULL,   -- 지역 그룹 코드 (예: E1, A1-C, N1-W)
    name_ko       VARCHAR(100) NOT NULL,
    name_en       VARCHAR(100) NOT NULL,
    region_group  VARCHAR(10)  NOT NULL,   -- 패키지 추천 필터 기준

    CONSTRAINT uq_countries_code UNIQUE (country_code)
);

COMMENT ON TABLE  countries              IS '국가/지역 마스터 — 23개 지역 그룹 코드 기반';
COMMENT ON COLUMN countries.country_code IS '지역 그룹 코드 (예: E1=영어권유럽, A1-C=일본중부, N1-W=미국서부)';
COMMENT ON COLUMN countries.region_group IS '패키지 추천 필터 기준';

-- RLS
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "countries: 전체 공개 읽기"
    ON countries FOR SELECT
    USING (true);

-- ============================================================
--  [교환학생 파트] 24. exchange_students  (교환학생 프로필)
--     users 1:1 확장 — 교환학생 전용 온보딩 데이터
--     정형 데이터 — 필터링 기준 컬럼으로 분리
--     비정형 데이터 — metadata JSONB 로 흡수
-- ============================================================

DROP TABLE IF EXISTS exchange_students CASCADE;

CREATE TABLE exchange_students (
    uid                   UUID             NOT NULL,
    country_id            INTEGER          NULL,
    region_group          VARCHAR(10)      NULL,       -- countries.region_group 비정규화 (추천 필터 효율화)
    housing_type          housing_type_t   NULL,       -- dorm | flat
    semester              VARCHAR(20)      NULL,       -- 예: '2026-1'
    language_pref         VARCHAR(5)       NOT NULL DEFAULT 'ko',  -- 'ko' | 'en'
    role                  exchange_role_t  NULL,       -- incoming | outgoing
    onboarding_completed  BOOLEAN          NOT NULL DEFAULT FALSE,
    metadata              JSONB            NOT NULL DEFAULT '{}',  -- 비정형 추가 정보
    created_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_exchange_students PRIMARY KEY (uid),
    CONSTRAINT fk_exchange_students_user
        FOREIGN KEY (uid)
        REFERENCES  users (uid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_exchange_students_country
        FOREIGN KEY (country_id)
        REFERENCES  countries (country_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
);

CREATE TRIGGER trg_exchange_students_updated_at
    BEFORE UPDATE ON exchange_students
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON TABLE  exchange_students                   IS '교환학생 프로필 — users 1:1 확장';
COMMENT ON COLUMN exchange_students.region_group      IS 'countries.region_group 비정규화 — 패키지 추천 필터 효율화';
COMMENT ON COLUMN exchange_students.language_pref     IS 'UI 언어 설정 ko(한국어) | en(영어)';
COMMENT ON COLUMN exchange_students.onboarding_completed IS '온보딩 4단계 완료 여부';
COMMENT ON COLUMN exchange_students.metadata          IS 'JSONB: 비정형 추가 정보';

-- RLS
ALTER TABLE exchange_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_students: 본인 프로필 접근"
    ON exchange_students FOR ALL
    TO authenticated
    USING  (uid = auth.uid())
    WITH CHECK (uid = auth.uid());

-- ============================================================
--  [교환학생 파트] 25. essential_packages  (패키지 템플릿 마스터)
--     다국어 이름은 JSONB (비정형) — 필터링 대상 아님
--     region_group / housing_type 은 정형 컬럼 — 추천 필터 기준
-- ============================================================

DROP TABLE IF EXISTS essential_packages CASCADE;

CREATE TABLE essential_packages (
    package_id     INTEGER          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    template_type  VARCHAR(50)      NOT NULL,
    name           JSONB            NOT NULL DEFAULT '{}',  -- { "ko": "...", "en": "..." }
    region_group   VARCHAR(10)      NULL,   -- NULL 이면 전 지역 공통
    housing_type   housing_type_t   NULL,   -- NULL 이면 모든 거주형태 적용
    created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_essential_packages_type UNIQUE (template_type)
);

COMMENT ON TABLE  essential_packages              IS '패키지 템플릿 마스터 (DORM_BASIC / FLAT_FULL / INCOMING_DORM)';
COMMENT ON COLUMN essential_packages.name         IS 'JSONB 다국어 이름 { "ko": "...", "en": "..." }';
COMMENT ON COLUMN essential_packages.region_group IS 'NULL 이면 전 지역 공통 템플릿';

-- RLS
ALTER TABLE essential_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "essential_packages: 전체 공개 읽기"
    ON essential_packages FOR SELECT
    USING (true);

-- ============================================================
--  [교환학생 파트] 26. package_items  (패키지 구성 물품)
--     기존 categories 테이블 재사용
-- ============================================================

DROP TABLE IF EXISTS package_items CASCADE;

CREATE TABLE package_items (
    package_item_id        INTEGER  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    package_id             INTEGER  NOT NULL,
    category_id            INTEGER  NOT NULL,
    is_required            BOOLEAN  NOT NULL DEFAULT TRUE,
    priority_order         INTEGER  NOT NULL DEFAULT 0,
    requires_hygiene_cert  BOOLEAN  NOT NULL DEFAULT FALSE,  -- 이불·베개·토퍼 등 세탁 인증 필요 여부

    CONSTRAINT uq_package_items UNIQUE (package_id, category_id),
    CONSTRAINT fk_package_items_package
        FOREIGN KEY (package_id)
        REFERENCES  essential_packages (package_id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_items_category
        FOREIGN KEY (category_id)
        REFERENCES  categories (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX idx_package_items_package ON package_items (package_id);

COMMENT ON TABLE  package_items                        IS '패키지 구성 물품 — essential_packages ↔ categories 연결';
COMMENT ON COLUMN package_items.requires_hygiene_cert  IS '세탁 인증 필요 여부 (이불·베개·토퍼 등)';
COMMENT ON COLUMN package_items.priority_order         IS '물품 표시 순서 (낮을수록 우선)';

-- RLS
ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_items: 전체 공개 읽기"
    ON package_items FOR SELECT
    USING (true);

-- ============================================================
--  [교환학생 파트] 27. package_matches  (바이어-셀러 매칭)
-- ============================================================

DROP TABLE IF EXISTS package_matches CASCADE;

CREATE TABLE package_matches (
    match_id    BIGINT           GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    package_id  INTEGER          NOT NULL,
    buyer_uid   UUID             NOT NULL,
    seller_uid  UUID             NOT NULL,
    status      match_status_t   NOT NULL DEFAULT 'pending',
    semester    VARCHAR(20)      NULL,
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_package_matches_no_self CHECK (buyer_uid <> seller_uid),
    CONSTRAINT fk_package_matches_package
        FOREIGN KEY (package_id)
        REFERENCES  essential_packages (package_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_matches_buyer
        FOREIGN KEY (buyer_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_matches_seller
        FOREIGN KEY (seller_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE TRIGGER trg_package_matches_updated_at
    BEFORE UPDATE ON package_matches
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_package_matches_buyer  ON package_matches (buyer_uid);
CREATE INDEX idx_package_matches_seller ON package_matches (seller_uid);
CREATE INDEX idx_package_matches_status ON package_matches (status);

COMMENT ON TABLE  package_matches        IS '교환학생 패키지 바이어-셀러 매칭';
COMMENT ON COLUMN package_matches.status IS 'ENUM match_status_t: pending | matched | completed | cancelled';

-- RLS
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

-- chat_rooms.package_match_id FK 추가 (package_matches 생성 후)
ALTER TABLE chat_rooms
    ADD CONSTRAINT fk_chat_rooms_package_match
        FOREIGN KEY (package_match_id)
        REFERENCES  package_matches (match_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT;

-- ============================================================
--  [교환학생 파트] 28. hygiene_certifications  (세탁 인증)
-- ============================================================

DROP TABLE IF EXISTS hygiene_certifications CASCADE;

CREATE TABLE hygiene_certifications (
    cert_id      BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    seller_uid   UUID            NOT NULL,
    category_id  INTEGER         NOT NULL,
    image_url    TEXT            NOT NULL,   -- Supabase Storage URL
    status       cert_status_t   NOT NULL DEFAULT 'pending',
    reviewed_at  TIMESTAMPTZ     NULL,
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_hygiene_cert_seller
        FOREIGN KEY (seller_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_hygiene_cert_category
        FOREIGN KEY (category_id)
        REFERENCES  categories (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE TRIGGER trg_hygiene_certifications_updated_at
    BEFORE UPDATE ON hygiene_certifications
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_hygiene_cert_seller ON hygiene_certifications (seller_uid);

COMMENT ON TABLE  hygiene_certifications         IS '세탁 인증 — 이불·베개·토퍼 등 위생 필수 물품';
COMMENT ON COLUMN hygiene_certifications.status  IS 'ENUM cert_status_t: pending | approved | rejected';
COMMENT ON COLUMN hygiene_certifications.image_url IS 'Supabase Storage URL — 세탁 완료 사진';

-- RLS
ALTER TABLE hygiene_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hygiene_certifications: 셀러 본인 접근"
    ON hygiene_certifications FOR ALL
    TO authenticated
    USING  (seller_uid = auth.uid())
    WITH CHECK (seller_uid = auth.uid());

-- ============================================================
--  [교환학생 파트] 29. package_listings  (패키지 전용 매물)
--     일반 products 와 분리 — 교환학생 마켓 전용
--     product_status_t ENUM 재사용
-- ============================================================

DROP TABLE IF EXISTS package_listings CASCADE;

CREATE TABLE package_listings (
    listing_id   BIGINT            GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    match_id     BIGINT            NOT NULL,
    seller_uid   UUID              NOT NULL,
    category_id  INTEGER           NOT NULL,
    status       product_status_t  NOT NULL DEFAULT 'selling',  -- 기존 ENUM 재사용
    semester     VARCHAR(20)       NULL,
    image_url    TEXT              NULL,   -- Supabase Storage URL
    cert_id      BIGINT            NULL,   -- FK → hygiene_certifications (NULL 가능)
    created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_package_listings_match
        FOREIGN KEY (match_id)
        REFERENCES  package_matches (match_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_listings_seller
        FOREIGN KEY (seller_uid)
        REFERENCES  users (uid)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_listings_category
        FOREIGN KEY (category_id)
        REFERENCES  categories (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_package_listings_cert
        FOREIGN KEY (cert_id)
        REFERENCES  hygiene_certifications (cert_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT
);

CREATE TRIGGER trg_package_listings_updated_at
    BEFORE UPDATE ON package_listings
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE INDEX idx_package_listings_match  ON package_listings (match_id);
CREATE INDEX idx_package_listings_seller ON package_listings (seller_uid);
CREATE INDEX idx_package_listings_status ON package_listings (status);

COMMENT ON TABLE  package_listings           IS '교환학생 패키지 전용 매물 — 일반 products 와 분리';
COMMENT ON COLUMN package_listings.status    IS 'ENUM product_status_t 재사용: selling | reserved | sold';
COMMENT ON COLUMN package_listings.cert_id   IS 'FK → hygiene_certifications — 세탁 인증 필요 물품에만 연결';
COMMENT ON COLUMN package_listings.image_url IS 'Supabase Storage URL';

-- RLS
ALTER TABLE package_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_listings: 인증 사용자 읽기"
    ON package_listings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "package_listings: 셀러 본인 등록"
    ON package_listings FOR INSERT
    TO authenticated
    WITH CHECK (seller_uid = auth.uid());

CREATE POLICY "package_listings: 셀러 본인 수정"
    ON package_listings FOR UPDATE
    TO authenticated
    USING  (seller_uid = auth.uid())
    WITH CHECK (seller_uid = auth.uid());

-- ============================================================
--  [교환학생 파트] 30. exchange_wishlists  (교환학생 알림 신청)
--     기존 wishlists(상품 pid 기반)와 구조 달라 별도 테이블로 분리
-- ============================================================

DROP TABLE IF EXISTS exchange_wishlists CASCADE;

CREATE TABLE exchange_wishlists (
    exchange_wishlist_id  BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uid                   UUID         NOT NULL,
    category_id           INTEGER      NOT NULL,
    region_group          VARCHAR(10)  NULL,
    semester              VARCHAR(20)  NULL,
    is_notified           BOOLEAN      NOT NULL DEFAULT FALSE,
    notified_at           TIMESTAMPTZ  NULL,
    deleted_at            TIMESTAMPTZ  NULL,   -- Soft Delete
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_exchange_wishlists UNIQUE (uid, category_id, region_group, semester),
    CONSTRAINT fk_exchange_wishlists_user
        FOREIGN KEY (uid)
        REFERENCES  users (uid)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT fk_exchange_wishlists_category
        FOREIGN KEY (category_id)
        REFERENCES  categories (category_id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT
);

CREATE INDEX idx_exchange_wishlists_uid ON exchange_wishlists (uid) WHERE deleted_at IS NULL;

COMMENT ON TABLE  exchange_wishlists             IS '교환학생 알림 신청 — 카테고리+지역 기반, 기존 wishlists 와 별도';
COMMENT ON COLUMN exchange_wishlists.is_notified IS '알림 발송 여부';
COMMENT ON COLUMN exchange_wishlists.deleted_at  IS 'Soft Delete — NULL 이면 활성';

-- RLS
ALTER TABLE exchange_wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_wishlists: 본인만 접근"
    ON exchange_wishlists FOR ALL
    TO authenticated
    USING  (uid = auth.uid() AND deleted_at IS NULL)
    WITH CHECK (uid = auth.uid());

-- ============================================================
--  [교환학생 파트] Supabase Realtime 추가
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE package_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE package_listings;

-- ============================================================
--  [교환학생 파트] SEED DATA
-- ============================================================

-- ── Seed: countries (23개 지역 그룹 — 기획안 기준) ──────────────
INSERT INTO countries (country_code, name_ko, name_en, region_group) VALUES
    ('E1',      '영어권 유럽',       'Anglophone Europe',   'E1'),
    ('E2',      '프랑스어권',        'Francophone',         'E2'),
    ('E3',      '독일어권',          'German-speaking',     'E3'),
    ('E4',      '남유럽',            'Southern Europe',     'E4'),
    ('E5',      '동유럽',            'Eastern Europe',      'E5'),
    ('A1-N',    '일본 북부',         'Japan North',         'A1-N'),
    ('A1-C',    '일본 중부/수도권',  'Japan Central',       'A1-C'),
    ('A1-W',    '일본 서부',         'Japan West',          'A1-W'),
    ('A2-N',    '중국 북부',         'China North',         'A2-N'),
    ('A2-C',    '중국 중부/동부',    'China Central/East',  'A2-C'),
    ('A2-S',    '중국 남부',         'China South',         'A2-S'),
    ('A3',      '동아시아/동남아',   'East/Southeast Asia', 'A3'),
    ('N1-W',    '미국 서부',         'US West',             'N1-W'),
    ('N1-C',    '미국 중부',         'US Central',          'N1-C'),
    ('N1-E',    '미국 동부',         'US East',             'N1-E'),
    ('N1-S',    '미국 남부/하와이',  'US South/Hawaii',     'N1-S'),
    ('N2-W',    '캐나다 서부',       'Canada West',         'N2-W'),
    ('N2-E',    '캐나다 동부',       'Canada East',         'N2-E'),
    ('O1',      '오세아니아',        'Oceania',             'O1'),
    ('S1',      '멕시코',            'Mexico',              'S1'),
    ('S2-BR',   '브라질',            'Brazil',              'S2-BR'),
    ('S2-CL',   '칠레',              'Chile',               'S2-CL'),
    ('S2-REST', '중남미 기타',       'LatAm Other',         'S2-REST')
ON CONFLICT (country_code) DO NOTHING;

-- ── Seed: essential_packages (템플릿 3종) ──────────────────────
INSERT INTO essential_packages (template_type, name, region_group, housing_type) VALUES
    ('DORM_BASIC',
     '{"ko": "기숙사 기본 패키지", "en": "Dorm Basic Package"}',
     NULL, 'dorm'),
    ('FLAT_FULL',
     '{"ko": "자취/플랫셰어 풀 패키지", "en": "Flat Full Package"}',
     NULL, 'flat'),
    ('INCOMING_DORM',
     '{"ko": "고려대 기숙사 입주 패키지", "en": "KU Incoming Dorm Package"}',
     NULL, 'dorm')
ON CONFLICT (template_type) DO NOTHING;

COMMIT;  -- 모든 DDL + Seed 정상 완료 시 커밋

-- ============================================================
--  실행 확인 쿼리 (선택)
-- ============================================================
-- SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name)))
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
