-- ============================================================
--  개발/테스트용 시드. 운영 데이터 별도.
--
--  대상 테이블:
--    - products            (매물 15건)
--    - product_images      (매물당 1~3장, 총 28장)
--    - book_conditions     (도서 매물 7건)
--    - device_conditions   (기기 매물 6건)
--    - (기타 카테고리 #12, #13 은 book/device 둘 다 NULL — 제3 케이스)
--
--  전제조건:
--    - 20260503000000_init.sql 적용 완료
--    - 옆 팀 users 시드 적용 완료
--      (nickname '전전삼학년', '경영이학년', '컴공신입생', '지우' 4건 존재)
--    - schema.sql categories 시드 적용 완료
--      ('전자기기'/'도서/교재'/'기타' top + '노트북/태블릿'/'전공 교재' 자식)
--
--  멱등성:
--    - 시드 매물 식별 마커: title LIKE '[DEV SEED]%'
--    - 이중 안전장치: seller_uid IN (시드용 4 nickname 의 uid) AND 결합
--      → 옆 팀이 우연히 마커를 써도 영향 0
--    - 트랜잭션 시작 시 DELETE → 그 뒤 INSERT (재실행 시 클린 재생성)
--    - product_images / book_conditions / device_conditions 는
--      products FK ON DELETE CASCADE 로 자동 정리, 별도 DELETE 불필요
--    - 자연키 조회: users.nickname / categories.name (+ parent JOIN)
--
--  주의:
--    - products.view_count 는 시드 단계에서 직접 INSERT (DEFAULT 0 덮어쓰기).
--      CLAUDE.md '직접 UPDATE 금지' 규칙은 운영 시 사용자 조회 이벤트에 적용
--      되는 것으로, 초기 시드 INSERT 에는 해당 X.
--
--  실행 단위:
--    - BEGIN/COMMIT 트랜잭션 — 중간 실패 시 전체 롤백.
-- ============================================================

BEGIN;

-- ============================================================
--  섹션 0. 기존 [DEV SEED] 매물 정리 (멱등성)
--    - 마커 + 시드용 seller 4명 nickname 이중 보호
--    - 자식 테이블은 FK CASCADE 로 자동 정리
-- ============================================================

DELETE FROM products
 WHERE title LIKE '[DEV SEED]%'
   AND seller_uid IN (
       SELECT uid FROM users
        WHERE nickname IN ('전전삼학년', '경영이학년', '컴공신입생', '지우')
   );

-- ============================================================
--  섹션 1. products — 15건
--
--  카테고리 분배:
--    - 전자기기 (top)              : #1, #7, #8                  → 3건
--    - 도서/교재 > 전공 교재       : #2, #3, #4, #5, #6, #14, #15 → 7건
--    - 전자기기 > 노트북/태블릿    : #9, #10, #11                 → 3건
--    - 기타 (top)                  : #12, #13                     → 2건
--
--  판매자 분배 (매너온도 변별력):
--    - 전전삼학년 (42.50): #1, #2, #7, #14   → 4건
--    - 경영이학년 (40.00): #3, #4, #9, #11   → 4건
--    - 컴공신입생 (38.50): #5, #8, #10, #13  → 4건
--    - 지우       (36.50): #6, #12, #15      → 3건
--
--  status:
--    - reserved : #5, #8, #13                → 3건 (예약중 뱃지 검증)
--    - selling  : 그 외                       → 12건
--
--  가격대  : 5,000 ~ 220,000원
--  view    : 12 ~ 350 (정렬 변별력)
--  created : NOW() - 2시간 ~ 25일 (정렬 변별력)
-- ============================================================

-- #1. 카시오 fx-991ES PLUS — 전전삼학년 / 전자기기(top)
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, c.category_id,
       '[DEV SEED] 카시오 fx-991ES PLUS 공학용 계산기',
       25000, 'good'::product_condition_t, 'selling'::product_status_t, 180,
       E'통계 실습용으로 잘 썼어요. 케이스 포함, 배터리 새것입니다.\n양도 가능 시간 평일 저녁.',
       NOW() - INTERVAL '3 days'
  FROM users u, categories c
 WHERE u.nickname = '전전삼학년'
   AND c.name = '전자기기' AND c.parent_id IS NULL;

-- #2. 통계학 원론 (제5판) — 전전삼학년 / 도서/교재 > 전공 교재
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] 통계학 원론 (제5판) 거의 새책',
       18000, 'like_new'::product_condition_t, 'selling'::product_status_t, 95,
       '한 학기 수강 후 거의 펼치지 않았습니다. 표시 거의 없음.',
       NOW() - INTERVAL '5 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '전전삼학년'
   AND sub.name = '전공 교재' AND p.name = '도서/교재';

-- #3. Database System Concepts 7판 — 경영이학년 / 도서/교재 > 전공 교재
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] Database System Concepts 7판',
       35000, 'good'::product_condition_t, 'selling'::product_status_t, 160,
       '연필로 일부 밑줄·필기 있음. 표지 깨끗.',
       NOW() - INTERVAL '8 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '경영이학년'
   AND sub.name = '전공 교재' AND p.name = '도서/교재';

-- #4. 핸즈온 머신러닝 2판 — 경영이학년 / 도서/교재 > 전공 교재
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] 핸즈온 머신러닝 2판 (필기 多)',
       22000, 'fair'::product_condition_t, 'selling'::product_status_t, 220,
       '실습 위주로 펜 필기 많음. 학습용으로 가성비 OK.',
       NOW() - INTERVAL '12 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '경영이학년'
   AND sub.name = '전공 교재' AND p.name = '도서/교재';

-- #5. ISLR — 컴공신입생 / 도서/교재 > 전공 교재 / reserved
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] ISLR (An Introduction to Statistical Learning)',
       28000, 'good'::product_condition_t, 'reserved'::product_status_t, 75,
       '예약 진행 중입니다. 영문판, 연필 밑줄 일부.',
       NOW() - INTERVAL '2 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '컴공신입생'
   AND sub.name = '전공 교재' AND p.name = '도서/교재';

-- #6. 통계학개론 정의용 4판 — 지우 / 도서/교재 > 전공 교재
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] 통계학개론 정의용 4판 (밑줄 多)',
       12000, 'fair'::product_condition_t, 'selling'::product_status_t, 50,
       '펜 밑줄 많고 변색 약간 있음. 가격 저렴하게 처분.',
       NOW() - INTERVAL '10 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '지우'
   AND sub.name = '전공 교재' AND p.name = '도서/교재';

-- #7. HP Prime G2 그래픽 계산기 — 전전삼학년 / 전자기기(top)
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, c.category_id,
       '[DEV SEED] HP Prime G2 그래픽 계산기',
       220000, 'like_new'::product_condition_t, 'selling'::product_status_t, 350,
       '풀구성 (본체+케이스+매뉴얼). 거의 새것 컨디션.',
       NOW() - INTERVAL '1 days'
  FROM users u, categories c
 WHERE u.nickname = '전전삼학년'
   AND c.name = '전자기기' AND c.parent_id IS NULL;

-- #8. 보스턴 BX2 공학용 계산기 — 컴공신입생 / 전자기기(top) / reserved
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, c.category_id,
       '[DEV SEED] 보스턴 BX2 공학용 계산기 (배터리 미포함)',
       45000, 'good'::product_condition_t, 'reserved'::product_status_t, 130,
       '예약 진행 중. 배터리 별도 구매 필요, 본체만 양도.',
       NOW() - INTERVAL '6 days'
  FROM users u, categories c
 WHERE u.nickname = '컴공신입생'
   AND c.name = '전자기기' AND c.parent_id IS NULL;

-- #9. 노트북 거치대 (각도 6단) — 경영이학년 / 전자기기 > 노트북/태블릿
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] 노트북 거치대 (각도 6단)',
       18000, 'good'::product_condition_t, 'selling'::product_status_t, 88,
       '6단계 각도 조절. 13~16인치 호환. 본체만.',
       NOW() - INTERVAL '4 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '경영이학년'
   AND sub.name = '노트북/태블릿' AND p.name = '전자기기';

-- #10. 알루미늄 노트북 받침대 — 컴공신입생 / 전자기기 > 노트북/태블릿
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] 알루미늄 노트북 받침대 — 작동 일부 이슈',
       8000, 'poor'::product_condition_t, 'selling'::product_status_t, 35,
       '높이 조절 레버 한쪽이 헐거움. 사용에는 큰 지장 없음.',
       NOW() - INTERVAL '15 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '컴공신입생'
   AND sub.name = '노트북/태블릿' AND p.name = '전자기기';

-- #11. 코딩용 모니터 받침대 — 경영이학년 / 전자기기 > 노트북/태블릿
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] 코딩용 모니터 받침대',
       25000, 'good'::product_condition_t, 'selling'::product_status_t, 110,
       '24~27인치 모니터용. 안정적인 무게감.',
       NOW() - INTERVAL '7 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '경영이학년'
   AND sub.name = '노트북/태블릿' AND p.name = '전자기기';

-- #12. 제도판 + T자 세트 — 지우 / 기타(top) / 조건 NULL
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, c.category_id,
       '[DEV SEED] 제도판 + T자 세트',
       15000, 'fair'::product_condition_t, 'selling'::product_status_t, 28,
       '제도 수업용. 제도판 표면 약간 사용감 있음.',
       NOW() - INTERVAL '20 days'
  FROM users u, categories c
 WHERE u.nickname = '지우'
   AND c.name = '기타' AND c.parent_id IS NULL;

-- #13. 컴퍼스/디바이더 세트 — 컴공신입생 / 기타(top) / reserved / 조건 NULL
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, c.category_id,
       '[DEV SEED] 컴퍼스/디바이더 세트 (제도용)',
       5000, 'good'::product_condition_t, 'reserved'::product_status_t, 12,
       '예약 진행 중. 케이스 포함 풀세트.',
       NOW() - INTERVAL '2 hours'
  FROM users u, categories c
 WHERE u.nickname = '컴공신입생'
   AND c.name = '기타' AND c.parent_id IS NULL;

-- #14. 통계 추론 (Casella & Berger) — 전전삼학년 / 도서/교재 > 전공 교재
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] 통계 추론 (Casella & Berger)',
       32000, 'good'::product_condition_t, 'selling'::product_status_t, 65,
       '대학원 입시 대비용으로 쓰던 책. 연필·펜 필기 일부.',
       NOW() - INTERVAL '25 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '전전삼학년'
   AND sub.name = '전공 교재' AND p.name = '도서/교재';

-- #15. 데이터베이스 시스템 — 한빛아카데미 — 지우 / 도서/교재 > 전공 교재
INSERT INTO products (seller_uid, category_id, title, price, condition, status, view_count, description, created_at)
SELECT u.uid, sub.category_id,
       '[DEV SEED] 데이터베이스 시스템 — 한빛아카데미',
       20000, 'good'::product_condition_t, 'selling'::product_status_t, 75,
       '연필 필기 일부, 표지 깨끗. 학부 수업 교재로 적합.',
       NOW() - INTERVAL '3 days'
  FROM users u, categories sub
  JOIN categories p ON p.category_id = sub.parent_id
 WHERE u.nickname = '지우'
   AND sub.name = '전공 교재' AND p.name = '도서/교재';

-- ============================================================
--  섹션 2. product_images — 총 28장
--    - 매물당 1~3장 분배 (이미지 슬라이더 검증)
--    - URL: placehold.co (외부 의존, ASCII 라벨만 사용)
--    - display_order: 0부터 N-1
-- ============================================================

-- #1 (3장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=Calculator+1', 0),
            ('https://placehold.co/400x400?text=Calculator+2', 1),
            ('https://placehold.co/400x400?text=Calculator+3', 2)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] 카시오 fx-991ES PLUS 공학용 계산기';

-- #2 (2장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=StatBook+1', 0),
            ('https://placehold.co/400x400?text=StatBook+2', 1)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] 통계학 원론 (제5판) 거의 새책';

-- #3 (2장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=DBBook+1', 0),
            ('https://placehold.co/400x400?text=DBBook+2', 1)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] Database System Concepts 7판';

-- #4 (3장 — 필기 多 → 페이지 샘플 多)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=MLBook+1', 0),
            ('https://placehold.co/400x400?text=MLBook+2', 1),
            ('https://placehold.co/400x400?text=MLBook+3', 2)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] 핸즈온 머신러닝 2판 (필기 多)';

-- #5 (2장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=ISLR+1', 0),
            ('https://placehold.co/400x400?text=ISLR+2', 1)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] ISLR (An Introduction to Statistical Learning)';

-- #6 (1장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, 'https://placehold.co/400x400?text=StatIntro+1', 0
  FROM products p
 WHERE p.title = '[DEV SEED] 통계학개론 정의용 4판 (밑줄 多)';

-- #7 (3장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=HPPrime+1', 0),
            ('https://placehold.co/400x400?text=HPPrime+2', 1),
            ('https://placehold.co/400x400?text=HPPrime+3', 2)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] HP Prime G2 그래픽 계산기';

-- #8 (2장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=BX2+1', 0),
            ('https://placehold.co/400x400?text=BX2+2', 1)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] 보스턴 BX2 공학용 계산기 (배터리 미포함)';

-- #9 (2장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=Stand+1', 0),
            ('https://placehold.co/400x400?text=Stand+2', 1)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] 노트북 거치대 (각도 6단)';

-- #10 (1장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, 'https://placehold.co/400x400?text=Pad+1', 0
  FROM products p
 WHERE p.title = '[DEV SEED] 알루미늄 노트북 받침대 — 작동 일부 이슈';

-- #11 (2장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=MonitorStand+1', 0),
            ('https://placehold.co/400x400?text=MonitorStand+2', 1)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] 코딩용 모니터 받침대';

-- #12 (1장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, 'https://placehold.co/400x400?text=DraftBoard+1', 0
  FROM products p
 WHERE p.title = '[DEV SEED] 제도판 + T자 세트';

-- #13 (1장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, 'https://placehold.co/400x400?text=Compass+1', 0
  FROM products p
 WHERE p.title = '[DEV SEED] 컴퍼스/디바이더 세트 (제도용)';

-- #14 (1장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, 'https://placehold.co/400x400?text=CaB+1', 0
  FROM products p
 WHERE p.title = '[DEV SEED] 통계 추론 (Casella & Berger)';

-- #15 (2장)
INSERT INTO product_images (pid, image_url, display_order)
SELECT p.pid, v.url, v.ord
  FROM products p,
       (VALUES
            ('https://placehold.co/400x400?text=DBHanbit+1', 0),
            ('https://placehold.co/400x400?text=DBHanbit+2', 1)
       ) AS v(url, ord)
 WHERE p.title = '[DEV SEED] 데이터베이스 시스템 — 한빛아카데미';

-- ============================================================
--  섹션 3. book_conditions — 7건
--    대상: #2, #3, #4, #5, #6, #14, #15 (도서/교재 > 전공 교재 매물)
--
--  컬럼:
--    underline_mark / handwriting  (book_mark_t  : none|pencil|pen)
--    cover_state                   (BOOLEAN: TRUE = 깨끗함)
--    name_written                  (BOOLEAN: TRUE = 이름 기재됨)
--    discoloration                 (BOOLEAN: TRUE = 변색 있음)
--    page_damage                   (BOOLEAN: TRUE = 페이지 손상)
-- ============================================================

-- #2 통계학 원론 — 거의 새책
INSERT INTO book_conditions (pid, underline_mark, handwriting, cover_state, name_written, discoloration, page_damage)
SELECT p.pid,
       'none'::book_mark_t, 'none'::book_mark_t,
       TRUE, FALSE, FALSE, FALSE
  FROM products p
 WHERE p.title = '[DEV SEED] 통계학 원론 (제5판) 거의 새책';

-- #3 DB Concepts — 연필 일부
INSERT INTO book_conditions (pid, underline_mark, handwriting, cover_state, name_written, discoloration, page_damage)
SELECT p.pid,
       'pencil'::book_mark_t, 'pencil'::book_mark_t,
       TRUE, FALSE, FALSE, FALSE
  FROM products p
 WHERE p.title = '[DEV SEED] Database System Concepts 7판';

-- #4 핸즈온 ML — 펜 필기 多
INSERT INTO book_conditions (pid, underline_mark, handwriting, cover_state, name_written, discoloration, page_damage)
SELECT p.pid,
       'pen'::book_mark_t, 'pen'::book_mark_t,
       TRUE, FALSE, FALSE, FALSE
  FROM products p
 WHERE p.title = '[DEV SEED] 핸즈온 머신러닝 2판 (필기 多)';

-- #5 ISLR — 연필 밑줄 일부
INSERT INTO book_conditions (pid, underline_mark, handwriting, cover_state, name_written, discoloration, page_damage)
SELECT p.pid,
       'pencil'::book_mark_t, 'none'::book_mark_t,
       TRUE, FALSE, FALSE, FALSE
  FROM products p
 WHERE p.title = '[DEV SEED] ISLR (An Introduction to Statistical Learning)';

-- #6 통계학개론 정의용 — 펜 밑줄 多, 변색 있음
INSERT INTO book_conditions (pid, underline_mark, handwriting, cover_state, name_written, discoloration, page_damage)
SELECT p.pid,
       'pen'::book_mark_t, 'pencil'::book_mark_t,
       TRUE, FALSE, TRUE, FALSE
  FROM products p
 WHERE p.title = '[DEV SEED] 통계학개론 정의용 4판 (밑줄 多)';

-- #14 통계 추론 — 연필+펜 일부
INSERT INTO book_conditions (pid, underline_mark, handwriting, cover_state, name_written, discoloration, page_damage)
SELECT p.pid,
       'pencil'::book_mark_t, 'pen'::book_mark_t,
       TRUE, FALSE, FALSE, FALSE
  FROM products p
 WHERE p.title = '[DEV SEED] 통계 추론 (Casella & Berger)';

-- #15 DB 시스템 한빛 — 연필 일부
INSERT INTO book_conditions (pid, underline_mark, handwriting, cover_state, name_written, discoloration, page_damage)
SELECT p.pid,
       'none'::book_mark_t, 'pencil'::book_mark_t,
       TRUE, FALSE, FALSE, FALSE
  FROM products p
 WHERE p.title = '[DEV SEED] 데이터베이스 시스템 — 한빛아카데미';

-- ============================================================
--  섹션 4. device_conditions — 6건
--    대상: #1, #7, #8, #9, #10, #11
--
--  컬럼: usage_wear / cleanliness    (grade_hml_t : high|mid|low)
--        operation_status            (device_op_t : normal|partial_issue)
--        battery_included            (included_t  : included|not_included)
--        accessories                 (accessories_t: body_only|case_included|manual_included)
--
--  의미 메모:
--    - usage_wear  high = 마모 많음, low = 마모 적음
--    - cleanliness high = 깨끗, low = 더러움
-- ============================================================

-- #1 카시오 fx-991ES PLUS — 사용감 적음, 깨끗, 정상, 배터리+케이스
INSERT INTO device_conditions (pid, usage_wear, cleanliness, operation_status, battery_included, accessories)
SELECT p.pid,
       'low'::grade_hml_t, 'mid'::grade_hml_t,
       'normal'::device_op_t, 'included'::included_t, 'case_included'::accessories_t
  FROM products p
 WHERE p.title = '[DEV SEED] 카시오 fx-991ES PLUS 공학용 계산기';

-- #7 HP Prime G2 — 거의 새것, 풀구성
INSERT INTO device_conditions (pid, usage_wear, cleanliness, operation_status, battery_included, accessories)
SELECT p.pid,
       'low'::grade_hml_t, 'high'::grade_hml_t,
       'normal'::device_op_t, 'included'::included_t, 'manual_included'::accessories_t
  FROM products p
 WHERE p.title = '[DEV SEED] HP Prime G2 그래픽 계산기';

-- #8 BX2 — 배터리 미포함, 본체만
INSERT INTO device_conditions (pid, usage_wear, cleanliness, operation_status, battery_included, accessories)
SELECT p.pid,
       'mid'::grade_hml_t, 'mid'::grade_hml_t,
       'normal'::device_op_t, 'not_included'::included_t, 'body_only'::accessories_t
  FROM products p
 WHERE p.title = '[DEV SEED] 보스턴 BX2 공학용 계산기 (배터리 미포함)';

-- #9 노트북 거치대 — 본체만, 비배터리 기기
INSERT INTO device_conditions (pid, usage_wear, cleanliness, operation_status, battery_included, accessories)
SELECT p.pid,
       'low'::grade_hml_t, 'high'::grade_hml_t,
       'normal'::device_op_t, 'not_included'::included_t, 'body_only'::accessories_t
  FROM products p
 WHERE p.title = '[DEV SEED] 노트북 거치대 (각도 6단)';

-- #10 알루미늄 받침대 — 작동 일부 이슈, 사용감 많음
INSERT INTO device_conditions (pid, usage_wear, cleanliness, operation_status, battery_included, accessories)
SELECT p.pid,
       'high'::grade_hml_t, 'low'::grade_hml_t,
       'partial_issue'::device_op_t, 'not_included'::included_t, 'body_only'::accessories_t
  FROM products p
 WHERE p.title = '[DEV SEED] 알루미늄 노트북 받침대 — 작동 일부 이슈';

-- #11 코딩용 모니터 받침대 — 정상, 본체만
INSERT INTO device_conditions (pid, usage_wear, cleanliness, operation_status, battery_included, accessories)
SELECT p.pid,
       'mid'::grade_hml_t, 'mid'::grade_hml_t,
       'normal'::device_op_t, 'not_included'::included_t, 'body_only'::accessories_t
  FROM products p
 WHERE p.title = '[DEV SEED] 코딩용 모니터 받침대';

COMMIT;
