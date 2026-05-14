-- ============================================================
--  테스트 시드 데이터
--  대상 테이블: categories(추가), package_templates,
--               package_template_items, resale_price_rules
--
--  실행 순서 (반드시 지킬 것):
--    1단계) 01-create-missing-tables.sql  ← 테이블 생성
--    2단계) 이 파일 (test-seed.sql)       ← 시드 데이터 삽입
--
--  주의:
--    - 재실행 시 기존 테스트 데이터를 삭제 후 재삽입 (멱등)
--    - 운영 데이터가 있는 환경에서는 실행 금지
-- ============================================================

BEGIN;

-- ============================================================
--  1. categories 추가
--     schema.sql 기본 시드에 없는 카테고리 보완
-- ============================================================

INSERT INTO categories (parent_id, name)
SELECT c.category_id, '침구류'
FROM categories c
WHERE c.name = '생활용품'
  AND NOT EXISTS (
    SELECT 1 FROM categories WHERE name = '침구류'
  );

INSERT INTO categories (parent_id, name)
SELECT c.category_id, '문구/오피스'
FROM categories c
WHERE c.name = '기타'
  AND NOT EXISTS (
    SELECT 1 FROM categories WHERE name = '문구/오피스'
  );


-- ============================================================
--  2. package_templates — 재실행 대비 삭제 후 삽입
--     ON DELETE CASCADE → package_template_items 자동 삭제
-- ============================================================

DELETE FROM package_templates
WHERE title IN (
  '기숙사 신입생 패키지',
  '자취 신입생 패키지',
  '기숙사 재학생 패키지',
  '자취 재학생 패키지',
  '전체 공통 패키지',
  '컴퓨터학과 신입생 기숙사 패키지',
  '경영학과 신입생 자취 패키지'
);

-- 5개 공통 템플릿 (학과 무관)
INSERT INTO package_templates
  (title, major_id, grade, housing_type, semester, description)
VALUES
  -- grade=1, dorm: 신입생 + 기숙사 → 가장 구체적
  ('기숙사 신입생 패키지',
   NULL, 1, 'dorm', NULL,
   '기숙사 생활을 시작하는 신입생을 위한 필수 물품 패키지'),

  -- grade=1, flat: 신입생 + 자취
  ('자취 신입생 패키지',
   NULL, 1, 'flat', NULL,
   '자취를 시작하는 신입생을 위한 필수 물품 패키지'),

  -- grade=NULL, dorm: 재학생 기숙사 (grade 명시 없음 → 신입생 다음 우선)
  ('기숙사 재학생 패키지',
   NULL, NULL, 'dorm', NULL,
   '기숙사 생활 재학생을 위한 패키지'),

  -- grade=NULL, flat: 재학생 자취
  ('자취 재학생 패키지',
   NULL, NULL, 'flat', NULL,
   '자취 생활 재학생을 위한 패키지'),

  -- 모든 조건 NULL: 폴백 패키지
  ('전체 공통 패키지',
   NULL, NULL, NULL, NULL,
   '모든 학생을 위한 기본 추천 패키지');

-- 학과별 특화 템플릿 예시 (컴퓨터학과)
INSERT INTO package_templates
  (title, major_id, grade, housing_type, semester, description)
SELECT
  '컴퓨터학과 신입생 기숙사 패키지',
  m.major_id,
  1,
  'dorm',
  NULL,
  '컴퓨터학과 신입생 기숙사 특화 패키지 (개발 도구 포함)'
FROM majors m
WHERE m.name = '컴퓨터학과';

-- 학과별 특화 템플릿 예시 (경영학과)
INSERT INTO package_templates
  (title, major_id, grade, housing_type, semester, description)
SELECT
  '경영학과 신입생 자취 패키지',
  m.major_id,
  1,
  'flat',
  NULL,
  '경영학과 신입생 자취 특화 패키지'
FROM majors m
WHERE m.name = '경영학과';


-- ============================================================
--  3. package_template_items
--     CTE로 템플릿 ID를 참조해 구성 물품 삽입
-- ============================================================

-- ── 기숙사 신입생 패키지 ────────────────────────────────────────
WITH tmpl AS (
  SELECT package_template_id FROM package_templates
  WHERE title = '기숙사 신입생 패키지'
)
INSERT INTO package_template_items
  (package_template_id, category_id, required_quantity, priority_order)
SELECT
  tmpl.package_template_id,
  c.category_id,
  v.qty,
  v.ord
FROM tmpl,
(VALUES
  ('침구류',          1, 1),
  ('청소/세탁',       1, 2),
  ('노트북/태블릿',   1, 3),
  ('이어폰/헤드폰',   1, 4),
  ('전공 교재',       3, 5),
  ('문구/오피스',     1, 6)
) AS v(cat_name, qty, ord)
JOIN categories c ON c.name = v.cat_name;


-- ── 자취 신입생 패키지 ──────────────────────────────────────────
WITH tmpl AS (
  SELECT package_template_id FROM package_templates
  WHERE title = '자취 신입생 패키지'
)
INSERT INTO package_template_items
  (package_template_id, category_id, required_quantity, priority_order)
SELECT
  tmpl.package_template_id,
  c.category_id,
  v.qty,
  v.ord
FROM tmpl,
(VALUES
  ('침구류',          1, 1),
  ('가구/인테리어',   1, 2),
  ('주방용품',        1, 3),
  ('청소/세탁',       1, 4),
  ('노트북/태블릿',   1, 5),
  ('전공 교재',       3, 6),
  ('문구/오피스',     1, 7)
) AS v(cat_name, qty, ord)
JOIN categories c ON c.name = v.cat_name;


-- ── 기숙사 재학생 패키지 ────────────────────────────────────────
WITH tmpl AS (
  SELECT package_template_id FROM package_templates
  WHERE title = '기숙사 재학생 패키지'
)
INSERT INTO package_template_items
  (package_template_id, category_id, required_quantity, priority_order)
SELECT
  tmpl.package_template_id,
  c.category_id,
  v.qty,
  v.ord
FROM tmpl,
(VALUES
  ('노트북/태블릿',   1, 1),
  ('전공 교재',       2, 2),
  ('이어폰/헤드폰',   1, 3),
  ('문구/오피스',     1, 4)
) AS v(cat_name, qty, ord)
JOIN categories c ON c.name = v.cat_name;


-- ── 자취 재학생 패키지 ──────────────────────────────────────────
WITH tmpl AS (
  SELECT package_template_id FROM package_templates
  WHERE title = '자취 재학생 패키지'
)
INSERT INTO package_template_items
  (package_template_id, category_id, required_quantity, priority_order)
SELECT
  tmpl.package_template_id,
  c.category_id,
  v.qty,
  v.ord
FROM tmpl,
(VALUES
  ('노트북/태블릿',   1, 1),
  ('전공 교재',       2, 2),
  ('주방용품',        1, 3),
  ('가구/인테리어',   1, 4),
  ('문구/오피스',     1, 5)
) AS v(cat_name, qty, ord)
JOIN categories c ON c.name = v.cat_name;


-- ── 전체 공통 패키지 ────────────────────────────────────────────
WITH tmpl AS (
  SELECT package_template_id FROM package_templates
  WHERE title = '전체 공통 패키지'
)
INSERT INTO package_template_items
  (package_template_id, category_id, required_quantity, priority_order)
SELECT
  tmpl.package_template_id,
  c.category_id,
  v.qty,
  v.ord
FROM tmpl,
(VALUES
  ('노트북/태블릿',   1, 1),
  ('전공 교재',       2, 2),
  ('문구/오피스',     1, 3)
) AS v(cat_name, qty, ord)
JOIN categories c ON c.name = v.cat_name;


-- ── 컴퓨터학과 신입생 기숙사 패키지 ────────────────────────────
WITH tmpl AS (
  SELECT package_template_id FROM package_templates
  WHERE title = '컴퓨터학과 신입생 기숙사 패키지'
)
INSERT INTO package_template_items
  (package_template_id, category_id, required_quantity, priority_order)
SELECT
  tmpl.package_template_id,
  c.category_id,
  v.qty,
  v.ord
FROM tmpl,
(VALUES
  ('노트북/태블릿',   1, 1),
  ('전공 교재',       4, 2),   -- CS 교재 많음
  ('이어폰/헤드폰',   1, 3),
  ('침구류',          1, 4),
  ('청소/세탁',       1, 5),
  ('문구/오피스',     1, 6)
) AS v(cat_name, qty, ord)
JOIN categories c ON c.name = v.cat_name;


-- ── 경영학과 신입생 자취 패키지 ────────────────────────────────
WITH tmpl AS (
  SELECT package_template_id FROM package_templates
  WHERE title = '경영학과 신입생 자취 패키지'
)
INSERT INTO package_template_items
  (package_template_id, category_id, required_quantity, priority_order)
SELECT
  tmpl.package_template_id,
  c.category_id,
  v.qty,
  v.ord
FROM tmpl,
(VALUES
  ('침구류',          1, 1),
  ('가구/인테리어',   1, 2),
  ('주방용품',        1, 3),
  ('노트북/태블릿',   1, 4),
  ('전공 교재',       3, 5),
  ('가방/지갑',       1, 6)
) AS v(cat_name, qty, ord)
JOIN categories c ON c.name = v.cat_name;


-- ============================================================
--  4. resale_price_rules — 재실행 대비 삭제 후 삽입
--
--  감가율 체계:
--    depreciation_rate: 기준가에서 차감할 비율 (0~1)
--    min_price_ratio:   기준가 대비 최소 추천 비율
--    max_price_ratio:   기준가 대비 최대 추천 비율
--
--  우선순위 (쿼리 ORDER BY):
--    1순위: category_id IS NOT NULL + condition IS NOT NULL (가장 구체적)
--    2순위: category_id IS NOT NULL + condition IS NULL
--    3순위: category_id IS NULL + condition IS NOT NULL
--    4순위: category_id IS NULL + condition IS NULL (기본 폴백)
-- ============================================================

-- 기존 테스트 규칙 삭제
-- (category_id가 NULL인 기본 규칙과 세 카테고리 전용 규칙 삭제)
DELETE FROM resale_price_rules
WHERE category_id IS NULL
   OR category_id IN (
     SELECT category_id FROM categories
     WHERE name IN ('노트북/태블릿', '스마트폰', '이어폰/헤드폰', '전공 교재', '가구/인테리어', '침구류')
   );


-- ── 노트북/태블릿 — 상태·사용기간별 세분화 ──────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT
  c.category_id,
  v.cond::product_condition_t,
  v.min_mo,
  v.max_mo,
  v.dep,
  v.mn,
  v.mx
FROM categories c,
(VALUES
  -- product_condition_t: high | medium | low (구 5단계 → 3단계)
  ('high',   0,   6,   0.15, 0.72, 0.92),
  ('high',   6,  18,   0.28, 0.62, 0.82),
  ('medium', 0,  12,   0.38, 0.52, 0.70),
  ('medium', 12, 30,   0.48, 0.44, 0.63),
  ('low',    0,  24,   0.57, 0.33, 0.53),
  ('low',    24, NULL,  0.68, 0.22, 0.42)
) AS v(cond, min_mo, max_mo, dep, mn, mx)
WHERE c.name = '노트북/태블릿';


-- ── 스마트폰 ────────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT
  c.category_id,
  v.cond::product_condition_t,
  v.min_mo,
  v.max_mo,
  v.dep,
  v.mn,
  v.mx
FROM categories c,
(VALUES
  ('high',   0,   6,   0.18, 0.70, 0.92),
  ('high',   6,  18,   0.32, 0.58, 0.78),
  ('medium', 0,  12,   0.42, 0.48, 0.65),
  ('medium', 12, 24,   0.50, 0.40, 0.60),
  ('low',    0,  24,   0.58, 0.32, 0.52),
  ('low',    24, NULL,  0.72, 0.20, 0.40)
) AS v(cond, min_mo, max_mo, dep, mn, mx)
WHERE c.name = '스마트폰';


-- ── 이어폰/헤드폰 ────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT
  c.category_id,
  v.cond::product_condition_t,
  v.min_mo,
  v.max_mo,
  v.dep,
  v.mn,
  v.mx
FROM categories c,
(VALUES
  ('high',   0,  12,   0.22, 0.68, 0.90),
  ('medium', 0,  18,   0.42, 0.48, 0.63),
  ('low',    0,  NULL, 0.63, 0.25, 0.45)
) AS v(cond, min_mo, max_mo, dep, mn, mx)
WHERE c.name = '이어폰/헤드폰';


-- ── 전공 교재 (상태 무관, 기간 무관 — 단순 정률) ────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT
  c.category_id,
  v.cond::product_condition_t,
  0,
  NULL,
  v.dep,
  v.mn,
  v.mx
FROM categories c,
(VALUES
  ('high',   0.28, 0.62, 0.83),
  ('medium', 0.50, 0.40, 0.60),
  ('low',    0.70, 0.20, 0.40)
) AS v(cond, dep, mn, mx)
WHERE c.name = '전공 교재';


-- ── 가구/인테리어 (사용기간 중심, 상태 무관) ────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT
  c.category_id,
  NULL,        -- condition 무관
  v.min_mo,
  v.max_mo,
  v.dep,
  v.mn,
  v.mx
FROM categories c,
(VALUES
  ( 0,  12,  0.25, 0.60, 0.85),
  (12,  36,  0.40, 0.45, 0.70),
  (36,  NULL, 0.55, 0.30, 0.55)
) AS v(min_mo, max_mo, dep, mn, mx)
WHERE c.name = '가구/인테리어';


-- ── 침구류 ──────────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT
  c.category_id,
  NULL,
  v.min_mo,
  v.max_mo,
  v.dep,
  v.mn,
  v.mx
FROM categories c,
(VALUES
  ( 0,  12,  0.35, 0.50, 0.75),
  (12,  NULL, 0.55, 0.30, 0.55)
) AS v(min_mo, max_mo, dep, mn, mx)
WHERE c.name = '침구류';


-- ── 기본 폴백 규칙 (category_id = NULL) ─────────────────────────
-- 특정 카테고리 규칙이 없을 때 사용됨
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
VALUES
  -- 사용기간 기준 단계별 감가 (상태 무관)
  (NULL, NULL,  0,  6,   0.25, 0.60, 0.85),
  (NULL, NULL,  6,  24,  0.40, 0.45, 0.70),
  (NULL, NULL,  24, 60,  0.55, 0.30, 0.55),
  (NULL, NULL,  60, NULL, 0.65, 0.20, 0.45),

  -- 상태 기준 단독 규칙 (기간 0~∞)
  (NULL, 'high',   0, NULL, 0.22, 0.68, 0.90),
  (NULL, 'medium', 0, NULL, 0.45, 0.45, 0.65),
  (NULL, 'low',    0, NULL, 0.68, 0.22, 0.42);


COMMIT;

-- ============================================================
--  검증 쿼리 (실행 후 결과 확인용)
-- ============================================================

-- 템플릿 + 구성물품 수 확인
-- SELECT
--   pt.title,
--   pt.grade,
--   pt.housing_type,
--   pt.major_id,
--   COUNT(pti.package_template_item_id) AS item_count
-- FROM package_templates pt
-- LEFT JOIN package_template_items pti
--   ON pti.package_template_id = pt.package_template_id
-- GROUP BY pt.package_template_id
-- ORDER BY pt.package_template_id;

-- 감가율 규칙 확인
-- SELECT
--   COALESCE(c.name, '(기본)') AS category,
--   condition,
--   usage_months_min,
--   usage_months_max,
--   (depreciation_rate * 100)::INT || '%' AS 감가율
-- FROM resale_price_rules r
-- LEFT JOIN categories c ON c.category_id = r.category_id
-- ORDER BY c.name NULLS LAST, condition, usage_months_min;
