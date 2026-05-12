-- ============================================================
--  샘플 데이터 (02-sample-data.sql)
--  대상 테이블: auth.users, public.users (프로필),
--               products, transactions, resale_price_rules
--
--  실행 순서:
--    1단계) 01-create-missing-tables.sql
--    2단계) test-seed.sql
--    3단계) 이 파일 (02-sample-data.sql)
--
--  테스트 계정 (비밀번호: test1234!)
--    seed.cs1@korea.ac.kr  — 컴퓨터학과 1학년
--    seed.biz2@korea.ac.kr — 경영학과 2학년
--    seed.ee3@korea.ac.kr  — 전기전자공학부 3학년
-- ============================================================

-- ============================================================
--  0-pre. 의존 카테고리 추가 (test-seed.sql 미실행 시 대비)
-- ============================================================

INSERT INTO categories (parent_id, name)
SELECT c.category_id, '침구류'
FROM categories c
WHERE c.name = '생활용품'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE name = '침구류');

INSERT INTO categories (parent_id, name)
SELECT c.category_id, '문구/오피스'
FROM categories c
WHERE c.name = '기타'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE name = '문구/오피스');

BEGIN;

-- ============================================================
--  0. 클린업 (멱등 재실행용) — FK 순서 주의
-- ============================================================

DELETE FROM transactions
WHERE buyer_uid IN (
    SELECT uid FROM public.users
    WHERE email LIKE 'seed.%@korea.ac.kr'
)
OR seller_uid IN (
    SELECT uid FROM public.users
    WHERE email LIKE 'seed.%@korea.ac.kr'
);

DELETE FROM products
WHERE seller_uid IN (
    SELECT uid FROM public.users
    WHERE email LIKE 'seed.%@korea.ac.kr'
);

DELETE FROM auth.users
WHERE email LIKE 'seed.%@korea.ac.kr';


-- ============================================================
--  1. 추가 resale_price_rules (test-seed.sql 에 없는 카테고리)
--     재실행 시 중복 방지: 해당 카테고리 규칙 먼저 삭제 후 재삽입
-- ============================================================

DELETE FROM resale_price_rules
WHERE category_id IN (
    SELECT category_id FROM categories
    WHERE name IN (
        '주방용품', '문구/오피스', '상의', '하의',
        '가방/지갑', '일반 도서', '문제집/참고서', '카메라'
    )
);

-- ── 주방용품 ────────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT c.category_id, NULL, v.min_mo, v.max_mo, v.dep, v.mn, v.mx
FROM categories c,
(VALUES
  ( 0,  12,  0.30, 0.55, 0.80),
  (12,  36,  0.45, 0.40, 0.65),
  (36, NULL,  0.60, 0.25, 0.50)
) AS v(min_mo, max_mo, dep, mn, mx)
WHERE c.name = '주방용품';

-- ── 문구/오피스 ──────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT c.category_id, NULL, 0, NULL, 0.40, 0.40, 0.70
FROM categories c
WHERE c.name = '문구/오피스';

-- ── 상의 ────────────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT c.category_id, v.cond::product_condition_t, 0, NULL, v.dep, v.mn, v.mx
FROM categories c,
(VALUES
  ('new',      0.20, 0.70, 0.90),
  ('like_new', 0.35, 0.55, 0.75),
  ('good',     0.50, 0.40, 0.60),
  ('fair',     0.65, 0.25, 0.45),
  ('poor',     0.75, 0.15, 0.35)
) AS v(cond, dep, mn, mx)
WHERE c.name = '상의';

-- ── 하의 ────────────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT c.category_id, v.cond::product_condition_t, 0, NULL, v.dep, v.mn, v.mx
FROM categories c,
(VALUES
  ('new',      0.20, 0.70, 0.90),
  ('like_new', 0.35, 0.55, 0.75),
  ('good',     0.50, 0.40, 0.60),
  ('fair',     0.65, 0.25, 0.45),
  ('poor',     0.75, 0.15, 0.35)
) AS v(cond, dep, mn, mx)
WHERE c.name = '하의';

-- ── 가방/지갑 ────────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT c.category_id, v.cond::product_condition_t, 0, NULL, v.dep, v.mn, v.mx
FROM categories c,
(VALUES
  ('new',      0.15, 0.75, 1.00),
  ('like_new', 0.30, 0.60, 0.80),
  ('good',     0.45, 0.45, 0.65),
  ('fair',     0.60, 0.30, 0.50),
  ('poor',     0.75, 0.15, 0.35)
) AS v(cond, dep, mn, mx)
WHERE c.name = '가방/지갑';

-- ── 일반 도서 ────────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT c.category_id, v.cond::product_condition_t, 0, NULL, v.dep, v.mn, v.mx
FROM categories c,
(VALUES
  ('new',      0.25, 0.65, 0.85),
  ('like_new', 0.40, 0.50, 0.70),
  ('good',     0.50, 0.40, 0.60),
  ('fair',     0.60, 0.30, 0.50),
  ('poor',     0.75, 0.15, 0.35)
) AS v(cond, dep, mn, mx)
WHERE c.name = '일반 도서';

-- ── 문제집/참고서 ────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT c.category_id, v.cond::product_condition_t, 0, NULL, v.dep, v.mn, v.mx
FROM categories c,
(VALUES
  ('new',      0.20, 0.70, 0.90),
  ('like_new', 0.35, 0.55, 0.75),
  ('good',     0.50, 0.40, 0.60),
  ('fair',     0.65, 0.25, 0.45),
  ('poor',     0.80, 0.10, 0.30)
) AS v(cond, dep, mn, mx)
WHERE c.name = '문제집/참고서';

-- ── 카메라 ──────────────────────────────────────────────────────
INSERT INTO resale_price_rules
  (category_id, condition, usage_months_min, usage_months_max,
   depreciation_rate, min_price_ratio, max_price_ratio)
SELECT c.category_id, v.cond::product_condition_t, v.min_mo, v.max_mo, v.dep, v.mn, v.mx
FROM categories c,
(VALUES
  ('new',       0,    6,  0.15, 0.75, 1.00),
  ('like_new',  0,   12,  0.25, 0.65, 0.85),
  ('like_new', 12,   36,  0.35, 0.55, 0.75),
  ('good',      0,   24,  0.40, 0.50, 0.70),
  ('good',     24, NULL,  0.50, 0.40, 0.60),
  ('fair',      0, NULL,  0.60, 0.30, 0.50),
  ('poor',      0, NULL,  0.75, 0.15, 0.35)
) AS v(cond, min_mo, max_mo, dep, mn, mx)
WHERE c.name = '카메라';


-- ============================================================
--  2. 테스트 사용자 3명 생성
--     — auth.users INSERT → trigger → public.users 자동 생성
--     — 이후 UPDATE로 major_id / grade / manner_temperature 보정
-- ============================================================

DO $$
DECLARE
  s1 UUID := gen_random_uuid();
  s2 UUID := gen_random_uuid();
  s3 UUID := gen_random_uuid();

  -- 거래 참조용 product UUID 변수
  p_nb1 UUID := gen_random_uuid();  -- 맥북 에어 M2
  p_nb2 UUID := gen_random_uuid();  -- 아이패드 에어 5세대
  p_nb3 UUID := gen_random_uuid();  -- 갤럭시 탭 S9
  p_ear1 UUID := gen_random_uuid(); -- AirPods Pro 2세대
  p_ear2 UUID := gen_random_uuid(); -- 소니 WH-1000XM5
  p_bk1 UUID := gen_random_uuid();  -- 자료구조론
  p_bk2 UUID := gen_random_uuid();  -- 경영학원론
  p_bk3 UUID := gen_random_uuid();  -- 알고리즘 (Introduction)
  p_bk4 UUID := gen_random_uuid();  -- 회계학원론
  p_kt1 UUID := gen_random_uuid();  -- 미니 전기밥솥
  p_furn1 UUID := gen_random_uuid();-- 1인용 원목 책상
  p_ph1 UUID := gen_random_uuid();  -- 아이폰 15 Pro
  p_ph2 UUID := gen_random_uuid();  -- 갤럭시 S24

BEGIN
  -- ── auth.users 삽입 ──────────────────────────────────────────
  INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES
  (
      s1,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'seed.cs1@korea.ac.kr',
      crypt('test1234!', gen_salt('bf')),
      NOW(),
      '{"nickname":"컴공신입생","student_id":"2024120001","school_domain":"korea.ac.kr"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      NOW(), NOW(), false, false
  ),
  (
      s2,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'seed.biz2@korea.ac.kr',
      crypt('test1234!', gen_salt('bf')),
      NOW(),
      '{"nickname":"경영이학년","student_id":"2023130002","school_domain":"korea.ac.kr"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      NOW(), NOW(), false, false
  ),
  (
      s3,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'seed.ee3@korea.ac.kr',
      crypt('test1234!', gen_salt('bf')),
      NOW(),
      '{"nickname":"전전삼학년","student_id":"2022140003","school_domain":"korea.ac.kr"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      NOW(), NOW(), false, false
  );

  -- ── public.users 프로필 보정 ─────────────────────────────────
  UPDATE public.users
  SET
      major_id = (SELECT major_id FROM majors WHERE name = '컴퓨터학과'),
      grade = 1,
      manner_temperature = 38.50
  WHERE uid = s1;

  UPDATE public.users
  SET
      major_id = (SELECT major_id FROM majors WHERE name = '경영학과'),
      grade = 2,
      manner_temperature = 40.00
  WHERE uid = s2;

  UPDATE public.users
  SET
      major_id = (SELECT major_id FROM majors WHERE name = '전기전자공학부'),
      grade = 3,
      manner_temperature = 42.50
  WHERE uid = s3;


  -- ============================================================
  --  3. 상품 데이터 삽입
  --     8개 카테고리 × 40여 개
  -- ============================================================

  -- ── 노트북/태블릿 (6개) ─────────────────────────────────────
  INSERT INTO products (pid, seller_uid, category_id, title, price, condition, description, status)
  SELECT
      v.pid, v.seller_uid,
      (SELECT category_id FROM categories WHERE name = '노트북/태블릿'),
      v.title, v.price, v.cond::product_condition_t, v.descr, v.status::product_status_t
  FROM (VALUES
      (p_nb1, s1, '맥북 에어 M2 13인치 8GB/256GB 미드나이트', 1050000, 'like_new',
       '2023년 초 구매, 충전기 포함, 배터리 92% 유지, 외관 기스 없음', 'selling'),
      (p_nb2, s2, '아이패드 에어 5세대 WiFi 64GB 스페이스 그레이', 480000, 'good',
       '애플펜슬 1세대 포함, 필름 부착 상태, 잔기스 약간', 'selling'),
      (p_nb3, s3, '삼성 갤럭시 탭 S9 FE 256GB 그린', 420000, 'like_new',
       'S펜 포함, 구매 6개월, 케이스 포함 드림', 'selling'),
      (gen_random_uuid(), s1, '레노버 씽크패드 X1 Carbon Gen 11', 1300000, 'good',
       '업무용 사용, i7-1365U/16GB/512GB, 충전기 포함', 'selling'),
      (gen_random_uuid(), s2, '델 XPS 15 9530 OLED 터치스크린', 1650000, 'like_new',
       'i9-13900H/32GB/1TB, RTX 4060, 구매 4개월 사용', 'selling'),
      (gen_random_uuid(), s3, '애플 매직키보드 한국어 Touch ID', 95000, 'good',
       '맥미니 교체로 판매, 배터리 정상 작동', 'selling')
  ) AS v(pid, seller_uid, title, price, cond, descr, status);

  -- ── 이어폰/헤드폰 (5개) ─────────────────────────────────────
  INSERT INTO products (pid, seller_uid, category_id, title, price, condition, description, status)
  SELECT
      v.pid, v.seller_uid,
      (SELECT category_id FROM categories WHERE name = '이어폰/헤드폰'),
      v.title, v.price, v.cond::product_condition_t, v.descr, v.status::product_status_t
  FROM (VALUES
      (p_ear1, s2, 'AirPods Pro 2세대 MagSafe 충전 케이스', 230000, 'like_new',
       '구매 5개월, 이어팁 교체 완료, 케이스 기스 없음', 'selling'),
      (p_ear2, s3, '소니 WH-1000XM5 노이즈캔슬링 헤드폰 블랙', 290000, 'good',
       '1년 사용, 쿠션 교체 완료, 케이블 포함', 'selling'),
      (gen_random_uuid(), s1, '삼성 갤럭시 버즈2 프로 그라파이트', 130000, 'good',
       '폰 교체로 판매, 배터리 정상, 케이스 포함', 'selling'),
      (gen_random_uuid(), s2, '보스 QuietComfort 45 화이트', 250000, 'fair',
       '이어쿠션 마모 있음, 노이즈캔슬링 정상 작동', 'selling'),
      (gen_random_uuid(), s3, 'JBL Tune 760NC 블루투스 헤드폰', 75000, 'good',
       '구매 8개월, 접이식 정상, 케이블 포함', 'selling')
  ) AS v(pid, seller_uid, title, price, cond, descr, status);

  -- ── 전공 교재 (8개) ─────────────────────────────────────────
  INSERT INTO products (pid, seller_uid, category_id, title, price, condition, description, status)
  SELECT
      v.pid, v.seller_uid,
      (SELECT category_id FROM categories WHERE name = '전공 교재'),
      v.title, v.price, v.cond::product_condition_t, v.descr, v.status::product_status_t
  FROM (VALUES
      (p_bk1, s1, '자료구조론 (C로 배우는 자료구조) 개정3판', 18000, 'good',
       '형광펜 필기 약간, 표지 멀쩡, 컴공 필수 교재', 'selling'),
      (p_bk2, s2, '경영학원론 (피터 드러커) 최신판', 22000, 'like_new',
       '연필 필기 지운 흔적 약간, 전반적으로 깨끗', 'selling'),
      (p_bk3, s1, 'Introduction to Algorithms (CLRS) 4th Edition', 45000, 'good',
       '알고리즘 수업 사용, 연필 밑줄 있음, 영어 원서', 'selling'),
      (p_bk4, s2, '회계학원론 제5판 (저자: 김동일)', 20000, 'fair',
       '많이 사용, 볼펜 밑줄 다수, 표지 약간 손상', 'selling'),
      (gen_random_uuid(), s3, '회로이론 (Nilsson & Riedel) 11th Edition', 38000, 'good',
       '전기전자 필수, 연필 필기 있음, 답안지 포함', 'selling'),
      (gen_random_uuid(), s1, '프로그래밍 언어론 (Sebesta) 12판', 30000, 'like_new',
       '한 학기 사용, 깨끗한 편, 형광펜 소량', 'selling'),
      (gen_random_uuid(), s2, '미적분학 (Stewart) 8판 - 짝수 문제 풀이집 포함', 32000, 'good',
       '1학년 수학, 연필 필기, 풀이집 세트 판매', 'selling'),
      (gen_random_uuid(), s3, '선형대수학 개론 (이상구 저) 최신판', 17000, 'like_new',
       '거의 새것, 연필 필기 2~3곳, 표지 깨끗', 'selling')
  ) AS v(pid, seller_uid, title, price, cond, descr, status);

  -- ── 문구/오피스 (4개) ───────────────────────────────────────
  INSERT INTO products (pid, seller_uid, category_id, title, price, condition, description, status)
  SELECT
      v.pid, v.seller_uid,
      (SELECT category_id FROM categories WHERE name = '문구/오피스'),
      v.title, v.price, v.cond::product_condition_t, v.descr, v.status::product_status_t
  FROM (VALUES
      (gen_random_uuid(), s3, '파이롯트 만년필 카쿠노 세트 (잉크 포함)', 35000, 'like_new',
       '선물 받아 잠깐 사용, 잉크 카트리지 2개 포함', 'selling'),
      (gen_random_uuid(), s1, '카시오 공학용 계산기 FX-991EX', 18000, 'good',
       '수업 사용, 버튼 정상 작동, 외관 기스 약간', 'selling'),
      (gen_random_uuid(), s2, '코멕스 A4 30공 바인더 3개 세트', 12000, 'like_new',
       '신학기 준비 과잉 구매, 2개 사용, 1개 미개봉', 'selling'),
      (gen_random_uuid(), s3, '스테들러 형광펜 세트 10색 + 마카 세트', 9000, 'good',
       '대부분 잉크 절반 이상 남음, 사용감 있음', 'selling')
  ) AS v(pid, seller_uid, title, price, cond, descr, status);

  -- ── 주방용품 (4개) ──────────────────────────────────────────
  INSERT INTO products (pid, seller_uid, category_id, title, price, condition, description, status)
  SELECT
      v.pid, v.seller_uid,
      (SELECT category_id FROM categories WHERE name = '주방용품'),
      v.title, v.price, v.cond::product_condition_t, v.descr, v.status::product_status_t
  FROM (VALUES
      (p_kt1, s2, '쿠첸 미니 전기밥솥 3인용 (CR-0375)', 45000, 'good',
       '자취 1년 사용, 깨끗하게 관리, 계량컵 포함', 'selling'),
      (gen_random_uuid(), s1, '드롱기 드립 커피메이커 ICM14011', 55000, 'good',
       '카페 생활 1년, 내부 스케일 제거 완료', 'selling'),
      (gen_random_uuid(), s3, '테팔 전기 주전자 BF6138 1.7L 화이트', 28000, 'like_new',
       '구매 3개월, 깨끗한 상태, 원산지 EU', 'selling'),
      (gen_random_uuid(), s2, '해피콜 다이아몬드 후라이팬 3종 세트', 38000, 'fair',
       '1년 사용, 코팅 약간 벗겨짐, 조리 가능 상태', 'selling')
  ) AS v(pid, seller_uid, title, price, cond, descr, status);

  -- ── 가구/인테리어 (4개) ─────────────────────────────────────
  INSERT INTO products (pid, seller_uid, category_id, title, price, condition, description, status)
  SELECT
      v.pid, v.seller_uid,
      (SELECT category_id FROM categories WHERE name = '가구/인테리어'),
      v.title, v.price, v.cond::product_condition_t, v.descr, v.status::product_status_t
  FROM (VALUES
      (p_furn1, s3, '1인용 원목 학생 책상 120×60 (직거래)', 85000, 'good',
       '이케아 LINNMON 조합, 2년 사용, 기스 약간', 'selling'),
      (gen_random_uuid(), s1, '허먼밀러 에어론 의자 사이즈B 리퍼', 650000, 'good',
       '판매점 리퍼품 구매, 2년 사용, 허리 지지 정상', 'selling'),
      (gen_random_uuid(), s2, '이케아 KALLAX 2×4 책장 화이트', 45000, 'fair',
       '이사 중 모서리 약간 손상, 조립 상태로 드림', 'selling'),
      (gen_random_uuid(), s3, '필립스 LED 스탠드 조명 HUE 화이트 앰비언스', 62000, 'like_new',
       '자취방 이사로 판매, 앱 제어 정상, 전구 포함', 'selling')
  ) AS v(pid, seller_uid, title, price, cond, descr, status);

  -- ── 스마트폰 (4개) ──────────────────────────────────────────
  INSERT INTO products (pid, seller_uid, category_id, title, price, condition, description, status)
  SELECT
      v.pid, v.seller_uid,
      (SELECT category_id FROM categories WHERE name = '스마트폰'),
      v.title, v.price, v.cond::product_condition_t, v.descr, v.status::product_status_t
  FROM (VALUES
      (p_ph1, s1, '아이폰 15 Pro 256GB 내추럴 티타늄 (SKT)', 1050000, 'like_new',
       '구매 4개월, 케이스·필름 부착, 배터리 97%', 'selling'),
      (p_ph2, s3, '갤럭시 S24 256GB 코발트 바이올렛 (자급제)', 880000, 'like_new',
       '개봉 6개월, 외관 무기스, 충전기 포함', 'selling'),
      (gen_random_uuid(), s2, '아이폰 13 128GB 스타라이트 (KT)', 620000, 'good',
       '2년 사용, 배터리 89%, 기스 약간, 잘 작동', 'selling'),
      (gen_random_uuid(), s1, '갤럭시 A54 5G 256GB 라임 (자급제)', 390000, 'good',
       '1년 사용, 화면·카메라 정상, 케이스 포함', 'selling')
  ) AS v(pid, seller_uid, title, price, cond, descr, status);

  -- ── 침구류 (3개) ────────────────────────────────────────────
  INSERT INTO products (pid, seller_uid, category_id, title, price, condition, description, status)
  SELECT
      v.pid, v.seller_uid,
      (SELECT category_id FROM categories WHERE name = '침구류'),
      v.title, v.price, v.cond::product_condition_t, v.descr, v.status::product_status_t
  FROM (VALUES
      (gen_random_uuid(), s2, '이케아 HÄXÖRT 싱글 이불 세트 + 커버', 28000, 'good',
       '세탁 완료, 보풀 약간, 기숙사 퇴사로 판매', 'selling'),
      (gen_random_uuid(), s3, '토퍼 매트리스 싱글 5cm 메모리폼 (직거래)', 55000, 'good',
       '1년 사용, 세탁 커버 포함, 외관 오염 없음', 'selling'),
      (gen_random_uuid(), s1, '호텔식 구스다운 베개 2개 세트', 32000, 'like_new',
       '사용 3개월, 세탁 완료, 커버 포함', 'selling')
  ) AS v(pid, seller_uid, title, price, cond, descr, status);


  -- ============================================================
  --  4. 거래 데이터 (12건, completed)
  --     chk_transactions_no_self: buyer_uid <> seller_uid 보장
  -- ============================================================

  INSERT INTO transactions
    (pid, buyer_uid, seller_uid, agreed_price, status, completed_at)
  VALUES
    -- 노트북 거래
    (p_nb1, s2, s1, 1000000, 'completed', NOW() - INTERVAL '30 days'),
    (p_nb2, s3, s2,  460000, 'completed', NOW() - INTERVAL '25 days'),
    (p_nb3, s1, s3,  400000, 'completed', NOW() - INTERVAL '20 days'),

    -- 이어폰/헤드폰 거래
    (p_ear1, s1, s2, 220000, 'completed', NOW() - INTERVAL '15 days'),
    (p_ear2, s2, s3, 280000, 'completed', NOW() - INTERVAL '10 days'),

    -- 전공 교재 거래
    (p_bk1, s2, s1, 17000, 'completed', NOW() - INTERVAL '35 days'),
    (p_bk2, s3, s2, 20000, 'completed', NOW() - INTERVAL '28 days'),
    (p_bk3, s2, s1, 43000, 'completed', NOW() - INTERVAL '22 days'),
    (p_bk4, s1, s2, 18000, 'completed', NOW() - INTERVAL '18 days'),

    -- 주방용품 거래
    (p_kt1, s1, s2, 43000, 'completed', NOW() - INTERVAL '12 days'),

    -- 가구 거래
    (p_furn1, s2, s3, 80000, 'completed', NOW() - INTERVAL '8 days'),

    -- 스마트폰 거래
    (p_ph1, s3, s1, 1020000, 'completed', NOW() - INTERVAL '5 days'),
    (p_ph2, s1, s3,  850000, 'completed', NOW() - INTERVAL '3 days');

  -- 거래 완료된 상품 status 갱신
  UPDATE products SET status = 'sold'
  WHERE pid IN (
      p_nb1, p_nb2, p_nb3,
      p_ear1, p_ear2,
      p_bk1, p_bk2, p_bk3, p_bk4,
      p_kt1, p_furn1, p_ph1, p_ph2
  );

END $$;

COMMIT;

-- ============================================================
--  검증 쿼리 (실행 후 확인)
-- ============================================================

-- 테스트 사용자 + 거래 수 확인
-- SELECT u.nickname, u.email, u.trade_count, u.major_id, u.grade
-- FROM public.users u
-- WHERE u.email LIKE 'seed.%@korea.ac.kr';

-- 카테고리별 상품 수 확인
-- SELECT c.name AS category, COUNT(*) AS product_count
-- FROM products p
-- JOIN categories c ON c.category_id = p.category_id
-- JOIN public.users u ON u.uid = p.seller_uid
-- WHERE u.email LIKE 'seed.%@korea.ac.kr'
-- GROUP BY c.name
-- ORDER BY c.name;

-- 거래 현황 확인
-- SELECT
--   t.transaction_id,
--   buyer.nickname AS buyer,
--   seller.nickname AS seller,
--   t.agreed_price,
--   t.status,
--   t.completed_at::DATE AS date
-- FROM transactions t
-- JOIN public.users buyer  ON buyer.uid  = t.buyer_uid
-- JOIN public.users seller ON seller.uid = t.seller_uid
-- WHERE buyer.email LIKE 'seed.%@korea.ac.kr'
-- ORDER BY t.completed_at DESC;

-- 감가율 규칙 전체 확인
-- SELECT
--   COALESCE(c.name, '(기본)') AS category,
--   condition,
--   usage_months_min,
--   usage_months_max,
--   (depreciation_rate * 100)::INT || '%' AS 감가율
-- FROM resale_price_rules r
-- LEFT JOIN categories c ON c.category_id = r.category_id
-- ORDER BY c.name NULLS LAST, condition, usage_months_min;
