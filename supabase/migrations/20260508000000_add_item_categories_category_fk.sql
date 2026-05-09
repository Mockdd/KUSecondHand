-- ============================================================
--  추가: item_categories.category_id  (상품 카테고리 1:1 매핑 FK)
--
--  배경:
--    추천 카테고리(item_categories) 와 상품 카테고리(categories) 가
--    별도 테이블이라, 추천 결과 페이지의 [상품 보러가기] 링크가
--    상품 카테고리 ID 를 알 수 없어 동작 불가했음.
--    item_categories 한 행에 대응되는 상품 카테고리를 직접 들고 있도록
--    nullable FK 한 개를 추가한다.
--
--  설계 결정:
--    - NULL 허용: 매핑이 아직 없는 추천 카테고리가 정상 케이스로 존재할 수 있음
--      (UI 에서 disabled 버튼으로 처리).
--    - ON DELETE SET NULL: 상품 카테고리가 삭제되어도 추천 카테고리 자체는 유지하고
--      매핑만 해제. 추천 행위(어떤 과목 → 어떤 종류의 물품) 는 여전히 의미가 있음.
--    - UNIQUE 제약 없음: 여러 추천 카테고리가 같은 상품 카테고리(예: '전공 교재') 로
--      모이는 것이 정상 — N:1 허용. (다만 의미상 1 행 ↔ 1 매핑이 의도)
-- ============================================================

BEGIN;

ALTER TABLE item_categories
    ADD COLUMN category_id INTEGER NULL;

ALTER TABLE item_categories
    ADD CONSTRAINT fk_item_categories_category
        FOREIGN KEY (category_id)
        REFERENCES  categories (category_id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT;

CREATE INDEX idx_item_categories_category
    ON item_categories (category_id);

COMMENT ON COLUMN item_categories.category_id
    IS '연결된 상품 카테고리 ID (FK → categories). NULL 이면 추천 결과의 [상품 보러가기] 버튼은 비활성.';

COMMIT;
