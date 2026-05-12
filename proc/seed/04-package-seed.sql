-- ============================================================
--  패키지 시드 데이터 (04-package-seed.sql)
--  대상 테이블: essential_packages, package_items
--
--  실행 순서:
--    1단계) schema.sql
--    2단계) test-seed.sql  ← categories(침구류·문구/오피스) 추가됨
--    3단계) 이 파일 (04-package-seed.sql)
--
--  패키지 3종:
--    DORM_BASIC     — 기숙사 기본 패키지
--    FLAT_FULL      — 자취/플랫셰어 풀 패키지
--    INCOMING_DORM  — 고려대 기숙사 입주 패키지
--
--  주의:
--    - 재실행 시 기존 데이터를 삭제 후 재삽입 (멱등)
--    - essential_packages.template_type 에 UNIQUE 제약이 있음
-- ============================================================

BEGIN;

-- ============================================================
--  0. 클린업
-- ============================================================

DELETE FROM package_items
WHERE package_id IN (
    SELECT package_id FROM essential_packages
    WHERE template_type IN ('DORM_BASIC', 'FLAT_FULL', 'INCOMING_DORM')
);

DELETE FROM essential_packages
WHERE template_type IN ('DORM_BASIC', 'FLAT_FULL', 'INCOMING_DORM');

-- ============================================================
--  1. essential_packages 삽입
-- ============================================================

INSERT INTO essential_packages (template_type, name_ko, name_en, housing_type)
VALUES
    ('DORM_BASIC',    '기숙사 기본 패키지',        'Dorm Basic Package',         'dorm'),
    ('FLAT_FULL',     '자취/플랫셰어 풀 패키지',   'Flat Full Package',           'flat'),
    ('INCOMING_DORM', '고려대 기숙사 입주 패키지', 'KU Incoming Dorm Package',   'dorm');

-- ============================================================
--  2. package_items 삽입 (category_id 는 name 으로 조인)
-- ============================================================

-- 침구류가 없을 경우 대비해 선삽입 (test-seed.sql 미실행 환경)
INSERT INTO categories (parent_id, name)
SELECT c.category_id, '침구류'
FROM categories c
WHERE c.name = '생활용품'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE name = '침구류');

-- ── DORM_BASIC: 기숙사 필수 구성 ────────────────────────────────

INSERT INTO package_items (package_id, category_id, is_required, priority_order, requires_hygiene_cert)
SELECT ep.package_id, c.category_id, v.is_required, v.priority_order, v.requires_hygiene_cert
FROM essential_packages ep
CROSS JOIN (VALUES
    ('침구류',       TRUE,  1, TRUE),
    ('가구/인테리어', TRUE,  2, FALSE),
    ('청소/세탁',    TRUE,  3, FALSE),
    ('전공 교재',    FALSE, 4, FALSE),
    ('가방/지갑',    FALSE, 5, FALSE)
) AS v(cat_name, is_required, priority_order, requires_hygiene_cert)
JOIN categories c ON c.name = v.cat_name
WHERE ep.template_type = 'DORM_BASIC';

-- ── FLAT_FULL: 자취 = 기숙사 항목 + 주방용품 추가 ─────────────────

INSERT INTO package_items (package_id, category_id, is_required, priority_order, requires_hygiene_cert)
SELECT ep.package_id, c.category_id, v.is_required, v.priority_order, v.requires_hygiene_cert
FROM essential_packages ep
CROSS JOIN (VALUES
    ('침구류',       TRUE,  1, TRUE),
    ('가구/인테리어', TRUE,  2, FALSE),
    ('주방용품',     TRUE,  3, FALSE),
    ('청소/세탁',    TRUE,  4, FALSE),
    ('전공 교재',    FALSE, 5, FALSE),
    ('가방/지갑',    FALSE, 6, FALSE),
    ('상의',         FALSE, 7, FALSE),
    ('하의',         FALSE, 8, FALSE)
) AS v(cat_name, is_required, priority_order, requires_hygiene_cert)
JOIN categories c ON c.name = v.cat_name
WHERE ep.template_type = 'FLAT_FULL';

-- ── INCOMING_DORM: 고려대 기숙사 규격 맞춤 ─────────────────────────

INSERT INTO package_items (package_id, category_id, is_required, priority_order, requires_hygiene_cert)
SELECT ep.package_id, c.category_id, v.is_required, v.priority_order, v.requires_hygiene_cert
FROM essential_packages ep
CROSS JOIN (VALUES
    ('침구류',       TRUE,  1, TRUE),
    ('가구/인테리어', TRUE,  2, FALSE),
    ('청소/세탁',    TRUE,  3, FALSE),
    ('전공 교재',    TRUE,  4, FALSE),
    ('이어폰/헤드폰', FALSE, 5, FALSE),
    ('가방/지갑',    FALSE, 6, FALSE)
) AS v(cat_name, is_required, priority_order, requires_hygiene_cert)
JOIN categories c ON c.name = v.cat_name
WHERE ep.template_type = 'INCOMING_DORM';

COMMIT;

-- ============================================================
--  확인 쿼리 (실행 후 검증용)
-- ============================================================
-- SELECT ep.template_type, ep.name_ko, COUNT(pi.package_item_id) AS item_count
-- FROM essential_packages ep
-- LEFT JOIN package_items pi ON pi.package_id = ep.package_id
-- GROUP BY ep.template_type, ep.name_ko
-- ORDER BY ep.package_id;
