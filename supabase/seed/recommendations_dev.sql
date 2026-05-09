-- ============================================================
--  개발/테스트용 시드. 운영 데이터 별도.
--
--  대상 테이블:
--    - item_categories         (추천 물품 카테고리 7건)
--    - courses                 (개설 과목 5건)
--    - course_schedules        (수업 시간 9건)
--    - course_recommendations  (과목 ↔ 카테고리 매핑 9건)
--
--  전제조건:
--    - 20260503000000_init.sql 적용 완료
--    - majors 테이블에 '컴퓨터학과', '통계학과' 시드 존재
--
--  멱등성:
--    - 같은 SQL 두 번 실행해도 에러/중복 없음.
--    - item_categories, course_recommendations: ON CONFLICT DO NOTHING
--    - courses, course_schedules: 자연키 UNIQUE 제약이 없어
--      INSERT … SELECT … WHERE NOT EXISTS 패턴으로 처리.
--
--  실행 단위:
--    - BEGIN/COMMIT 트랜잭션으로 감싸 중간 실패 시 전체 롤백.
-- ============================================================

BEGIN;

-- ============================================================
--  섹션 1. item_categories — 7건
--  (공학용 계산기, 통계 전공서적, 데이터베이스 전공서적,
--   머신러닝 교재, 노트북 거치대, 제도 도구, 코딩 노트북 스탠드)
-- ============================================================

INSERT INTO item_categories (name, type, description) VALUES
    ('공학용 계산기',         'DEVICE', '수치 계산·통계 실습에 쓰이는 공학용 계산기'),
    ('통계 전공서적',         'BOOK',   '통계학 기초·이론 과목 교재'),
    ('데이터베이스 전공서적', 'BOOK',   '관계형 DB 이론·SQL 학습용 교재'),
    ('머신러닝 교재',         'BOOK',   '머신러닝/딥러닝 입문서 및 전공 교재'),
    ('노트북 거치대',         'DEVICE', '장시간 코딩·실습용 노트북 거치대'),
    -- dangling 카테고리 — 의도적 (추천 매핑 없음, edge case 테스트용)
    ('제도 도구',             'ETC',    '제도판·자/컴퍼스 등 도면 작업 도구'),
    ('코딩 노트북 스탠드',    'DEVICE', '코딩 자세 교정용 각도 조절 스탠드')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
--  섹션 2. courses — 5건
--  major_id 는 majors 테이블에서 학과명으로 동적 조회.
--  course_code 에 UNIQUE 제약이 없어 WHERE NOT EXISTS 로 멱등 보장.
--
--  STAT201 통계학개론 (통계학과, 2학년, 김지영)
--  COSE371 데이터베이스 (컴퓨터학과, 3학년, 이상민)
--  COSE362 머신러닝 (컴퓨터학과, 3학년, 박준호)
--  MATH201 선형대수 (통계학과, 2학년, 정수현)
--  STAT301 확률론 (통계학과, 3학년, 최예진)
-- ============================================================

INSERT INTO courses (course_code, name, professor, credit, grade_level, category_type, major_id)
SELECT 'STAT201', '통계학개론', '김지영', 3, 2, 'major'::course_category_t, m.major_id
FROM majors m
WHERE m.name = '통계학과'
  AND NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'STAT201');

INSERT INTO courses (course_code, name, professor, credit, grade_level, category_type, major_id)
SELECT 'COSE371', '데이터베이스', '이상민', 3, 3, 'major'::course_category_t, m.major_id
FROM majors m
WHERE m.name = '컴퓨터학과'
  AND NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'COSE371');

INSERT INTO courses (course_code, name, professor, credit, grade_level, category_type, major_id)
SELECT 'COSE362', '머신러닝', '박준호', 3, 3, 'major'::course_category_t, m.major_id
FROM majors m
WHERE m.name = '컴퓨터학과'
  AND NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'COSE362');

INSERT INTO courses (course_code, name, professor, credit, grade_level, category_type, major_id)
SELECT 'MATH201', '선형대수', '정수현', 3, 2, 'major'::course_category_t, m.major_id
FROM majors m
WHERE m.name = '통계학과'
  AND NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'MATH201');

INSERT INTO courses (course_code, name, professor, credit, grade_level, category_type, major_id)
SELECT 'STAT301', '확률론', '최예진', 3, 3, 'major'::course_category_t, m.major_id
FROM majors m
WHERE m.name = '통계학과'
  AND NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'STAT301');

-- ============================================================
--  섹션 3. course_schedules — 총 9건
--  course_id 는 course_code 로 동적 조회.
--  (course_id, day_of_week, start_time) 자연키로 WHERE NOT EXISTS.
--
--  STAT201  통계학개론   MON 09:00–10:30, WED 09:00–10:30
--  COSE371  데이터베이스 TUE 13:00–14:30, THU 13:00–14:30
--  COSE362  머신러닝     MON 13:00–14:30, WED 13:00–14:30
--  MATH201  선형대수     TUE 10:30–12:00
--  STAT301  확률론       THU 10:30–12:00, FRI 10:30–12:00
-- ============================================================

-- 통계학개론
INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
SELECT c.course_id, 'MON'::day_of_week_t, '09:00'::TIME, '10:30'::TIME
FROM courses c
WHERE c.course_code = 'STAT201'
  AND NOT EXISTS (
    SELECT 1 FROM course_schedules cs
    WHERE cs.course_id = c.course_id
      AND cs.day_of_week = 'MON'::day_of_week_t
      AND cs.start_time = '09:00'::TIME
  );

INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
SELECT c.course_id, 'WED'::day_of_week_t, '09:00'::TIME, '10:30'::TIME
FROM courses c
WHERE c.course_code = 'STAT201'
  AND NOT EXISTS (
    SELECT 1 FROM course_schedules cs
    WHERE cs.course_id = c.course_id
      AND cs.day_of_week = 'WED'::day_of_week_t
      AND cs.start_time = '09:00'::TIME
  );

-- 데이터베이스
INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
SELECT c.course_id, 'TUE'::day_of_week_t, '13:00'::TIME, '14:30'::TIME
FROM courses c
WHERE c.course_code = 'COSE371'
  AND NOT EXISTS (
    SELECT 1 FROM course_schedules cs
    WHERE cs.course_id = c.course_id
      AND cs.day_of_week = 'TUE'::day_of_week_t
      AND cs.start_time = '13:00'::TIME
  );

INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
SELECT c.course_id, 'THU'::day_of_week_t, '13:00'::TIME, '14:30'::TIME
FROM courses c
WHERE c.course_code = 'COSE371'
  AND NOT EXISTS (
    SELECT 1 FROM course_schedules cs
    WHERE cs.course_id = c.course_id
      AND cs.day_of_week = 'THU'::day_of_week_t
      AND cs.start_time = '13:00'::TIME
  );

-- 머신러닝
INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
SELECT c.course_id, 'MON'::day_of_week_t, '13:00'::TIME, '14:30'::TIME
FROM courses c
WHERE c.course_code = 'COSE362'
  AND NOT EXISTS (
    SELECT 1 FROM course_schedules cs
    WHERE cs.course_id = c.course_id
      AND cs.day_of_week = 'MON'::day_of_week_t
      AND cs.start_time = '13:00'::TIME
  );

INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
SELECT c.course_id, 'WED'::day_of_week_t, '13:00'::TIME, '14:30'::TIME
FROM courses c
WHERE c.course_code = 'COSE362'
  AND NOT EXISTS (
    SELECT 1 FROM course_schedules cs
    WHERE cs.course_id = c.course_id
      AND cs.day_of_week = 'WED'::day_of_week_t
      AND cs.start_time = '13:00'::TIME
  );

-- 선형대수
INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
SELECT c.course_id, 'TUE'::day_of_week_t, '10:30'::TIME, '12:00'::TIME
FROM courses c
WHERE c.course_code = 'MATH201'
  AND NOT EXISTS (
    SELECT 1 FROM course_schedules cs
    WHERE cs.course_id = c.course_id
      AND cs.day_of_week = 'TUE'::day_of_week_t
      AND cs.start_time = '10:30'::TIME
  );

-- 확률론
INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
SELECT c.course_id, 'THU'::day_of_week_t, '10:30'::TIME, '12:00'::TIME
FROM courses c
WHERE c.course_code = 'STAT301'
  AND NOT EXISTS (
    SELECT 1 FROM course_schedules cs
    WHERE cs.course_id = c.course_id
      AND cs.day_of_week = 'THU'::day_of_week_t
      AND cs.start_time = '10:30'::TIME
  );

INSERT INTO course_schedules (course_id, day_of_week, start_time, end_time)
SELECT c.course_id, 'FRI'::day_of_week_t, '10:30'::TIME, '12:00'::TIME
FROM courses c
WHERE c.course_code = 'STAT301'
  AND NOT EXISTS (
    SELECT 1 FROM course_schedules cs
    WHERE cs.course_id = c.course_id
      AND cs.day_of_week = 'FRI'::day_of_week_t
      AND cs.start_time = '10:30'::TIME
  );

-- ============================================================
--  섹션 4. course_recommendations — 9건
--  course_id, item_category_id 모두 자연키로 동적 조회.
--  priority: 10 = 1차 추천, 5 = 2차 추천.
--
--  통계학개론   → 공학용 계산기(10), 통계 전공서적(5)
--  데이터베이스 → 데이터베이스 전공서적(10), 노트북 거치대(5)
--  머신러닝     → 머신러닝 교재(10), 코딩 노트북 스탠드(5)
--  선형대수     → 공학용 계산기(10)
--  확률론       → 공학용 계산기(10), 통계 전공서적(5)
-- ============================================================

INSERT INTO course_recommendations (course_id, item_category_id, reason_template, priority)
SELECT c.course_id, ic.item_category_id,
       '{course_name} 수강생들이 자주 찾는 물품이에요', 10
FROM courses c, item_categories ic
WHERE c.course_code = 'STAT201' AND ic.name = '공학용 계산기'
ON CONFLICT (course_id, item_category_id) DO NOTHING;

INSERT INTO course_recommendations (course_id, item_category_id, reason_template, priority)
SELECT c.course_id, ic.item_category_id,
       '{course_name} 교재로 자주 쓰여요', 5
FROM courses c, item_categories ic
WHERE c.course_code = 'STAT201' AND ic.name = '통계 전공서적'
ON CONFLICT (course_id, item_category_id) DO NOTHING;

INSERT INTO course_recommendations (course_id, item_category_id, reason_template, priority)
SELECT c.course_id, ic.item_category_id,
       '{course_name} 교재로 자주 쓰여요', 10
FROM courses c, item_categories ic
WHERE c.course_code = 'COSE371' AND ic.name = '데이터베이스 전공서적'
ON CONFLICT (course_id, item_category_id) DO NOTHING;

INSERT INTO course_recommendations (course_id, item_category_id, reason_template, priority)
SELECT c.course_id, ic.item_category_id,
       '{course_name} 실습에 도움돼요', 5
FROM courses c, item_categories ic
WHERE c.course_code = 'COSE371' AND ic.name = '노트북 거치대'
ON CONFLICT (course_id, item_category_id) DO NOTHING;

INSERT INTO course_recommendations (course_id, item_category_id, reason_template, priority)
SELECT c.course_id, ic.item_category_id,
       '{course_name} 교재로 자주 쓰여요', 10
FROM courses c, item_categories ic
WHERE c.course_code = 'COSE362' AND ic.name = '머신러닝 교재'
ON CONFLICT (course_id, item_category_id) DO NOTHING;

INSERT INTO course_recommendations (course_id, item_category_id, reason_template, priority)
SELECT c.course_id, ic.item_category_id,
       '{course_name} 실습에 도움돼요', 5
FROM courses c, item_categories ic
WHERE c.course_code = 'COSE362' AND ic.name = '코딩 노트북 스탠드'
ON CONFLICT (course_id, item_category_id) DO NOTHING;

INSERT INTO course_recommendations (course_id, item_category_id, reason_template, priority)
SELECT c.course_id, ic.item_category_id,
       '{course_name} 수강생들이 자주 찾는 물품이에요', 10
FROM courses c, item_categories ic
WHERE c.course_code = 'MATH201' AND ic.name = '공학용 계산기'
ON CONFLICT (course_id, item_category_id) DO NOTHING;

INSERT INTO course_recommendations (course_id, item_category_id, reason_template, priority)
SELECT c.course_id, ic.item_category_id,
       '{course_name} 수강생들이 자주 찾는 물품이에요', 10
FROM courses c, item_categories ic
WHERE c.course_code = 'STAT301' AND ic.name = '공학용 계산기'
ON CONFLICT (course_id, item_category_id) DO NOTHING;

INSERT INTO course_recommendations (course_id, item_category_id, reason_template, priority)
SELECT c.course_id, ic.item_category_id,
       '{course_name} 교재로 자주 쓰여요', 5
FROM courses c, item_categories ic
WHERE c.course_code = 'STAT301' AND ic.name = '통계 전공서적'
ON CONFLICT (course_id, item_category_id) DO NOTHING;

COMMIT;
