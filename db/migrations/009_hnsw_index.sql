-- Migration 009: IVFFlat → HNSW 인덱스 교체
-- 문제: migration 008에서 IVFFlat(lists=100)으로 생성했으나
--       데이터가 39건뿐이라 대부분 클러스터가 비고, probes=1이면 0건 반환
-- 해결: HNSW로 교체 (데이터 수 관계없이 정확하게 동작)

-- 기존 IVFFlat 인덱스 제거
DROP INDEX IF EXISTS idx_product_embeddings_vec;
DROP INDEX IF EXISTS idx_package_embeddings_vec;

-- HNSW 인덱스 생성 (cosine similarity)
CREATE INDEX idx_product_embeddings_vec
  ON product_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_package_embeddings_vec
  ON package_embeddings USING hnsw (embedding vector_cosine_ops);
