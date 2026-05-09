-- ============================================================
--  개발/테스트용 시드: item_categories.category_id 매핑 갱신.
--
--  대상:
--    item_categories 7 건 → categories 매핑 (UPDATE only).
--
--  매핑 결정 (팀 합의, 2026-05-09):
--    1. 공학용 계산기         → 전자기기                       (top-level)
--    2. 통계 전공서적         → 도서/교재 > 전공 교재
--    3. 데이터베이스 전공서적 → 도서/교재 > 전공 교재
--    4. 머신러닝 교재         → 도서/교재 > 전공 교재
--    5. 노트북 거치대         → 전자기기 > 노트북/태블릿
--    6. 제도 도구             → 기타                           (top-level)
--    7. 코딩 노트북 스탠드    → 전자기기 > 노트북/태블릿
--
--  전제조건:
--    - migrations/20260508000000_add_item_categories_category_fk.sql 적용 완료
--      (category_id 컬럼 + FK 제약이 존재해야 함)
--    - seed/recommendations_dev.sql 적용 완료
--      (item_categories 7 행 INSERT 가 선행되어야 UPDATE 대상이 존재)
--    - schema.sql 의 categories 시드 적용 완료
--      (전자기기/도서/교재/기타 + 서브카테고리 행이 존재해야 매칭 성공)
--
--  멱등성:
--    - UPDATE 만 수행 — 같은 SQL 두 번 실행해도 결과 동일.
--    - 카테고리 조회는 (parent.name, child.name) 자연키 기반.
--    - 대상 행 없으면 0 rows affected 로 조용히 통과.
--
--  실행 단위:
--    - BEGIN/COMMIT 트랜잭션 — 일부 매핑 실패 시 전체 롤백.
-- ============================================================

BEGIN;

-- 1. 공학용 계산기 → 전자기기 (top-level)
UPDATE item_categories ic
   SET category_id = c.category_id
  FROM categories c
 WHERE ic.name     = '공학용 계산기'
   AND c.name      = '전자기기'
   AND c.parent_id IS NULL;

-- 2. 통계 전공서적 → 도서/교재 > 전공 교재
UPDATE item_categories ic
   SET category_id = sub.category_id
  FROM categories sub
  JOIN categories parent ON parent.category_id = sub.parent_id
 WHERE ic.name     = '통계 전공서적'
   AND sub.name    = '전공 교재'
   AND parent.name = '도서/교재';

-- 3. 데이터베이스 전공서적 → 도서/교재 > 전공 교재
UPDATE item_categories ic
   SET category_id = sub.category_id
  FROM categories sub
  JOIN categories parent ON parent.category_id = sub.parent_id
 WHERE ic.name     = '데이터베이스 전공서적'
   AND sub.name    = '전공 교재'
   AND parent.name = '도서/교재';

-- 4. 머신러닝 교재 → 도서/교재 > 전공 교재
UPDATE item_categories ic
   SET category_id = sub.category_id
  FROM categories sub
  JOIN categories parent ON parent.category_id = sub.parent_id
 WHERE ic.name     = '머신러닝 교재'
   AND sub.name    = '전공 교재'
   AND parent.name = '도서/교재';

-- 5. 노트북 거치대 → 전자기기 > 노트북/태블릿
UPDATE item_categories ic
   SET category_id = sub.category_id
  FROM categories sub
  JOIN categories parent ON parent.category_id = sub.parent_id
 WHERE ic.name     = '노트북 거치대'
   AND sub.name    = '노트북/태블릿'
   AND parent.name = '전자기기';

-- 6. 제도 도구 → 기타 (top-level)
UPDATE item_categories ic
   SET category_id = c.category_id
  FROM categories c
 WHERE ic.name     = '제도 도구'
   AND c.name      = '기타'
   AND c.parent_id IS NULL;

-- 7. 코딩 노트북 스탠드 → 전자기기 > 노트북/태블릿
UPDATE item_categories ic
   SET category_id = sub.category_id
  FROM categories sub
  JOIN categories parent ON parent.category_id = sub.parent_id
 WHERE ic.name     = '코딩 노트북 스탠드'
   AND sub.name    = '노트북/태블릿'
   AND parent.name = '전자기기';

COMMIT;
