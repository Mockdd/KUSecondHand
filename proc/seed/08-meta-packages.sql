-- ============================================================
--  메인 추천 패키지 카드 재구성 시드 (08-meta-packages.sql)
--  대상 테이블: essential_packages, package_items, (package_matches)
--
--  목적:
--    - 메인 페이지 "추천 패키지" 카드 (FeaturedPackages 컴포넌트) 데이터 재구성
--    - 카드 3개 → 카드 2개로 축소 (INCOMING_DORM 제거)
--    - DORM_BASIC / FLAT_FULL 의 카테고리 매핑을 신규 명세대로 재구성
--
--  실행 순서:
--    1단계) schema.sql
--    2단계) test-seed.sql
--    3단계) 04-package-seed.sql
--    4단계) 이 파일 (08-meta-packages.sql)        ← 04를 덮어씀
--
--  재구성 후 상태:
--    DORM_BASIC  "기숙사 기본 패키지"      (housing='dorm')
--      카테고리: 침구류, 청소/세탁
--    FLAT_FULL   "자취/플랫셰어 풀 패키지" (housing='flat')
--      카테고리: 침구류, 가구/인테리어, 주방용품, 청소/세탁, 식품/음료, 전자기기
--
--  주의:
--    - 멱등 (재실행 시 동일 결과)
--    - INCOMING_DORM 의 package_matches 행이 있을 경우 FK RESTRICT 로 essential_packages
--      DELETE 가 실패할 수 있어 package_matches 행도 선제거 (시드/매물 없는 환경에서는 NO-OP)
-- ============================================================

BEGIN;

-- ============================================================
--  1. INCOMING_DORM 정리 (자식 → 부모 순서)
-- ============================================================

-- 1-1. package_matches 의 INCOMING_DORM 행 제거 (있다면)
DELETE FROM package_matches
WHERE package_id IN (
    SELECT package_id FROM essential_packages
    WHERE template_type = 'INCOMING_DORM'
);

-- 1-2. package_items 의 INCOMING_DORM 행 제거
DELETE FROM package_items
WHERE package_id IN (
    SELECT package_id FROM essential_packages
    WHERE template_type = 'INCOMING_DORM'
);

-- 1-3. essential_packages 의 INCOMING_DORM 제거
DELETE FROM essential_packages
WHERE template_type = 'INCOMING_DORM';

-- ============================================================
--  2. DORM_BASIC / FLAT_FULL 의 package_items 클린업 (멱등 재실행용)
-- ============================================================

DELETE FROM package_items
WHERE package_id IN (
    SELECT package_id FROM essential_packages
    WHERE template_type IN ('DORM_BASIC', 'FLAT_FULL')
);

-- ============================================================
--  3. DORM_BASIC 새 매핑 — 침구류, 청소/세탁
-- ============================================================

INSERT INTO package_items (package_id, category_id, is_required, priority_order, requires_hygiene_cert)
SELECT ep.package_id, c.category_id, v.is_required, v.priority_order, v.requires_hygiene_cert
FROM essential_packages ep
CROSS JOIN (VALUES
    ('침구류',    TRUE, 1, TRUE),
    ('청소/세탁', TRUE, 2, FALSE)
) AS v(cat_name, is_required, priority_order, requires_hygiene_cert)
JOIN categories c ON c.name = v.cat_name
WHERE ep.template_type = 'DORM_BASIC';

-- ============================================================
--  4. FLAT_FULL 새 매핑 — 침구류, 가구/인테리어, 주방용품, 청소/세탁, 식품/음료, 전자기기
-- ============================================================

INSERT INTO package_items (package_id, category_id, is_required, priority_order, requires_hygiene_cert)
SELECT ep.package_id, c.category_id, v.is_required, v.priority_order, v.requires_hygiene_cert
FROM essential_packages ep
CROSS JOIN (VALUES
    ('침구류',       TRUE, 1, TRUE),
    ('가구/인테리어', TRUE, 2, FALSE),
    ('주방용품',     TRUE, 3, FALSE),
    ('청소/세탁',    TRUE, 4, FALSE),
    ('식품/음료',    TRUE, 5, FALSE),
    ('전자기기',     TRUE, 6, FALSE)
) AS v(cat_name, is_required, priority_order, requires_hygiene_cert)
JOIN categories c ON c.name = v.cat_name
WHERE ep.template_type = 'FLAT_FULL';

COMMIT;

-- ============================================================
--  검증 쿼리 (실행 후 직접 확인용)
-- ============================================================
-- SELECT ep.template_type, ep.name_ko, ep.housing_type, ep.package_id,
--        COUNT(pi.package_item_id) AS item_count
-- FROM essential_packages ep
-- LEFT JOIN package_items pi ON pi.package_id = ep.package_id
-- GROUP BY ep.template_type, ep.name_ko, ep.housing_type, ep.package_id
-- ORDER BY ep.package_id;
--
-- SELECT ep.template_type, c.name AS category_name, pi.priority_order, pi.is_required
-- FROM essential_packages ep
-- JOIN package_items pi ON pi.package_id = ep.package_id
-- JOIN categories c ON c.category_id = pi.category_id
-- WHERE ep.template_type IN ('DORM_BASIC', 'FLAT_FULL')
-- ORDER BY ep.template_type, pi.priority_order;
