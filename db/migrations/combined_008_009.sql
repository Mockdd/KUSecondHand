-- ============================================================
--  통합 마이그레이션: 008 ~ 009 (Hybrid Search + HNSW 인덱스)
--  실행 전 필수: Supabase 대시보드 → Database → Extensions → vector 활성화
--  Supabase SQL Editor에서 한 번에 실행
-- ============================================================


-- ----------------------------------------------------------------
-- 008-1: 확장 활성화
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ----------------------------------------------------------------
-- 008-2: embedding 테이블 생성
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_embeddings (
    pid         UUID          NOT NULL PRIMARY KEY,
    embedding   vector(1536)  NOT NULL,
    embedded_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_product_embeddings_pid
        FOREIGN KEY (pid) REFERENCES products(pid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS package_embeddings (
    package_id  INTEGER       NOT NULL PRIMARY KEY,
    embedding   vector(1536)  NOT NULL,
    embedded_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_package_embeddings_id
        FOREIGN KEY (package_id) REFERENCES essential_packages(package_id) ON DELETE CASCADE
);


-- ----------------------------------------------------------------
-- 008-3 → 009: HNSW 인덱스 (IVFFlat 건너뜀 — 소규모 데이터에서 0건 문제)
-- ----------------------------------------------------------------
DROP INDEX IF EXISTS idx_product_embeddings_vec;
DROP INDEX IF EXISTS idx_package_embeddings_vec;

CREATE INDEX IF NOT EXISTS idx_product_embeddings_vec
    ON product_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_package_embeddings_vec
    ON package_embeddings USING hnsw (embedding vector_cosine_ops);


-- ----------------------------------------------------------------
-- 008-4: pg_trgm fuzzy 검색 인덱스
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_title_trgm
    ON products USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_packages_name_trgm
    ON essential_packages USING gin ((name::text) gin_trgm_ops);


-- ----------------------------------------------------------------
-- 008-5: RPC 함수 — 매물 semantic 검색
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_products_semantic(
    query_embedding vector(1536),
    match_count     integer DEFAULT 50
)
RETURNS TABLE (pid uuid, similarity float)
LANGUAGE sql STABLE
AS $$
    SELECT pe.pid,
           1 - (pe.embedding <=> query_embedding) AS similarity
    FROM product_embeddings pe
    JOIN products p ON p.pid = pe.pid
    WHERE p.deleted_at IS NULL AND p.status = 'selling'
    ORDER BY pe.embedding <=> query_embedding
    LIMIT match_count;
$$;


-- ----------------------------------------------------------------
-- 008-6: RPC 함수 — 매물 fuzzy 검색
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_products_fuzzy(
    query_text  text,
    match_count integer DEFAULT 50
)
RETURNS TABLE (pid uuid, similarity float)
LANGUAGE sql STABLE
AS $$
    SELECT p.pid,
           similarity(p.title, query_text) AS similarity
    FROM products p
    WHERE p.deleted_at IS NULL
      AND p.status = 'selling'
      AND p.title % query_text
    ORDER BY similarity(p.title, query_text) DESC
    LIMIT match_count;
$$;


-- ----------------------------------------------------------------
-- 008-7: RPC 함수 — 패키지 semantic 검색
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_packages_semantic(
    query_embedding vector(1536),
    match_count     integer DEFAULT 20
)
RETURNS TABLE (package_id integer, similarity float)
LANGUAGE sql STABLE
AS $$
    SELECT pe.package_id,
           1 - (pe.embedding <=> query_embedding) AS similarity
    FROM package_embeddings pe
    ORDER BY pe.embedding <=> query_embedding
    LIMIT match_count;
$$;


-- ----------------------------------------------------------------
-- 008-8: RPC 함수 — 패키지 fuzzy 검색
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_packages_fuzzy(
    query_text  text,
    match_count integer DEFAULT 20
)
RETURNS TABLE (package_id integer, similarity float)
LANGUAGE sql STABLE
AS $$
    SELECT p.package_id,
           similarity(p.name::text, query_text) AS similarity
    FROM essential_packages p
    WHERE p.name::text % query_text
    ORDER BY similarity(p.name::text, query_text) DESC
    LIMIT match_count;
$$;
