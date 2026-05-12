-- ============================================================
--  교환학생 시드 데이터 (03-exchange-seed.sql)
--  대상 테이블: auth.users, public.users, exchange_students
--
--  실행 순서:
--    1단계) schema.sql (테이블 생성)
--    2단계) test-seed.sql (패키지 템플릿 등)
--    3단계) 이 파일 (03-exchange-seed.sql)
--
--  테스트 계정 (비밀번호: Exchange1234!)
--    exch.us1@korea.ac.kr  — 미국(영어권 북미), 기숙사, incoming
--    exch.de2@korea.ac.kr  — 독일(서유럽), 자취, outgoing
--    exch.jp3@korea.ac.kr  — 일본(동북아시아), 기숙사, incoming
--    exch.kr4@korea.ac.kr  — 한국(KR), 자취, outgoing (일반 케이스)
--
--  주의:
--    - 재실행 시 기존 데이터를 삭제 후 재삽입 (멱등)
--    - 운영 데이터가 있는 환경에서는 실행 금지
--    - Supabase Dashboard > Authentication > Users 에서 비밀번호 직접 설정 필요
--      (SQL로는 Argon2 해시 없이 auth.users에 직접 비밀번호 삽입 불가)
-- ============================================================

BEGIN;

-- ============================================================
--  0. 클린업 (멱등 재실행용)
-- ============================================================

DELETE FROM exchange_students
WHERE uid IN (
    SELECT uid FROM public.users
    WHERE email LIKE 'exch.%@korea.ac.kr'
);

DELETE FROM public.users
WHERE email LIKE 'exch.%@korea.ac.kr';

DELETE FROM auth.users
WHERE email LIKE 'exch.%@korea.ac.kr';

-- ============================================================
--  1. auth.users 생성
-- ============================================================

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
)
VALUES
    (
        'a1000001-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        'exch.us1@korea.ac.kr',
        crypt('Exchange1234!', gen_salt('bf')),
        NOW(), '{"provider":"email"}', '{}',
        NOW(), NOW(), '', ''
    ),
    (
        'a1000002-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        'exch.de2@korea.ac.kr',
        crypt('Exchange1234!', gen_salt('bf')),
        NOW(), '{"provider":"email"}', '{}',
        NOW(), NOW(), '', ''
    ),
    (
        'a1000003-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        'exch.jp3@korea.ac.kr',
        crypt('Exchange1234!', gen_salt('bf')),
        NOW(), '{"provider":"email"}', '{}',
        NOW(), NOW(), '', ''
    ),
    (
        'a1000004-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        'exch.kr4@korea.ac.kr',
        crypt('Exchange1234!', gen_salt('bf')),
        NOW(), '{"provider":"email"}', '{}',
        NOW(), NOW(), '', ''
    );

-- ============================================================
--  2. public.users 프로필
-- ============================================================

INSERT INTO public.users (uid, email, nickname, student_id, major_id)
SELECT
    a.id,
    a.email,
    v.nickname,
    v.student_id,
    m.major_id
FROM auth.users a
JOIN (VALUES
    ('exch.us1@korea.ac.kr', 'AmyUS',    '2024011001'),
    ('exch.de2@korea.ac.kr', 'MaxDE',    '2024011002'),
    ('exch.jp3@korea.ac.kr', 'TaroJP',   '2024011003'),
    ('exch.kr4@korea.ac.kr', '교환학생김', '2024011004')
) AS v(email, nickname, student_id) ON a.email = v.email
LEFT JOIN majors m ON m.name = '컴퓨터학과'
WHERE a.email LIKE 'exch.%@korea.ac.kr';

-- ============================================================
--  3. exchange_students 프로필
--     country_id: countries 테이블의 country_code 기준으로 조인
-- ============================================================

-- exch.us1 — 미국(NA 영어권), 기숙사, incoming, 영어 선호
INSERT INTO exchange_students (uid, country_id, region_group, housing_type, semester, language_pref, role, onboarding_completed)
SELECT
    u.uid,
    c.country_id,
    c.region_group,
    'dorm',
    '2026-1',
    'en',
    'incoming',
    TRUE
FROM public.users u
JOIN countries c ON c.country_code = 'US'
WHERE u.email = 'exch.us1@korea.ac.kr';

-- exch.de2 — 독일(서유럽 W1), 자취, outgoing, 영어 선호
INSERT INTO exchange_students (uid, country_id, region_group, housing_type, semester, language_pref, role, onboarding_completed)
SELECT
    u.uid,
    c.country_id,
    c.region_group,
    'flat',
    '2026-1',
    'en',
    'outgoing',
    TRUE
FROM public.users u
JOIN countries c ON c.country_code = 'DE'
WHERE u.email = 'exch.de2@korea.ac.kr';

-- exch.jp3 — 일본(동북아시아 AS1), 기숙사, incoming, 한국어 선호
INSERT INTO exchange_students (uid, country_id, region_group, housing_type, semester, language_pref, role, onboarding_completed)
SELECT
    u.uid,
    c.country_id,
    c.region_group,
    'dorm',
    '2026-1',
    'ko',
    'incoming',
    TRUE
FROM public.users u
JOIN countries c ON c.country_code = 'JP'
WHERE u.email = 'exch.jp3@korea.ac.kr';

-- exch.kr4 — 한국(KR), 자취, outgoing, 한국어 선호
INSERT INTO exchange_students (uid, country_id, region_group, housing_type, semester, language_pref, role, onboarding_completed)
SELECT
    u.uid,
    c.country_id,
    c.region_group,
    'flat',
    '2026-1',
    'ko',
    'outgoing',
    TRUE
FROM public.users u
JOIN countries c ON c.country_code = 'KR'
WHERE u.email = 'exch.kr4@korea.ac.kr';

COMMIT;
