-- ============================================================
--  product_related_majors RLS 정책 추가 (06b-product-related-majors-rls.sql)
--
--  배경:
--    06-product-related-majors.sql 의 초기 버전이 RLS 정책 없이 테이블만 생성.
--    Supabase 기본 동작상 anon/authenticated 클라이언트는 SELECT 시
--    빈 배열을 받게 되어, 패키지 추천에서 모든 매물이 '학과 무관'으로 통과되는 버그.
--
--  이 파일은 06 이 이미 라이브 DB 에 적용된 상태에서 빠르게 정책만 덧붙이기 위한 패치.
--    - 데이터는 건드리지 않음
--    - 멱등 (DROP POLICY IF EXISTS → CREATE POLICY)
--
--  사용:
--    Supabase 대시보드 → SQL Editor 에 이 파일 내용을 붙여넣고 실행.
--    (또는 psql 로 직접 실행)
-- ============================================================

BEGIN;

ALTER TABLE product_related_majors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_related_majors: 전체 공개 읽기" ON product_related_majors;
CREATE POLICY "product_related_majors: 전체 공개 읽기"
    ON product_related_majors FOR SELECT
    USING (true);

COMMIT;


-- ── 검증 (실행 후 수동 확인) ────────────────────────────────────
--  Supabase SQL Editor 에서 'anon' 으로 시뮬레이션:
--    SET ROLE anon;
--    SELECT count(*) FROM product_related_majors;   -- 101 이 나오면 OK
--    RESET ROLE;
