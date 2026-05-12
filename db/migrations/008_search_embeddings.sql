-- Migration 008: Hybrid search (pgvector + pg_trgm)
-- 실행 전 확인: Supabase 대시보드에서 pgvector extension이 활성화되어 있어야 함
-- Database → Extensions → vector 검색 후 활성화

-- 1. 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 매물 embedding 테이블
CREATE TABLE IF NOT EXISTS product_embeddings (
    pid         UUID          NOT NULL PRIMARY KEY,
    embedding   vector(1536)  NOT NULL,
    embedded_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_product_embeddings_pid
        FOREIGN KEY (pid) REFERENCES products(pid) ON DELETE CASCADE
);

-- 3. 패키지 embedding 테이블
CREATE TABLE IF NOT EXISTS package_embeddings (
    package_id  INTEGER       NOT NULL PRIMARY KEY,
    embedding   vector(1536)  NOT NULL,
    embedded_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_package_embeddings_id
        FOREIGN KEY (package_id) REFERENCES essential_packages(package_id) ON DELETE CASCADE
);

-- 4. pgvector IVFFlat 인덱스 (ANN 검색)
CREATE INDEX IF NOT EXISTS idx_product_embeddings_vec
    ON product_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_package_embeddings_vec
    ON package_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- 5. pg_trgm 인덱스 (fuzzy 검색)
CREATE INDEX IF NOT EXISTS idx_products_title_trgm
    ON products USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_packages_name_trgm
    ON essential_packages USING gin ((name_ko || ' ' || name_en) gin_trgm_ops);

-- 6. RPC 함수 — 매물 semantic 검색
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

-- 7. RPC 함수 — 매물 fuzzy 검색
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

-- 8. RPC 함수 — 패키지 semantic 검색
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

-- 9. RPC 함수 — 패키지 fuzzy 검색
CREATE OR REPLACE FUNCTION match_packages_fuzzy(
    query_text  text,
    match_count integer DEFAULT 20
)
RETURNS TABLE (package_id integer, similarity float)
LANGUAGE sql STABLE
AS $$
    SELECT p.package_id,
           similarity(p.name_ko || ' ' || p.name_en, query_text) AS similarity
    FROM essential_packages p
    WHERE (p.name_ko || ' ' || p.name_en) % query_text
    ORDER BY similarity(p.name_ko || ' ' || p.name_en, query_text) DESC
    LIMIT match_count;
$$;
