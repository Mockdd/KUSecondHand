-- ============================================================
--  매물-학과 다대다(M:N) 매핑 시드 (06-product-related-majors.sql)
--  대상 테이블: product_related_majors (신규 생성)
--
--  실행 순서:
--    1단계) schema.sql                       (majors / products 정의)
--    2단계) test-seed.sql                    (categories 보강)
--    3단계) 04a-persona-seed.sql             (페르소나 20명)
--    4단계) 04b-package-template-seed.sql    (패키지 템플릿)
--    5단계) 05-product-seed.sql              (매물 200건 INSERT)
--    6단계) 이 파일 (06-product-related-majors.sql)
--
--  설계:
--    - 옆 팀과 합의: products 에 학과 매핑 추가 (단일 FK → M:N 변경)
--    - 1매물 = N학과 가능. 학과 무관 매물(기기·생활용품·의류·식품·어학시험)은 row 미삽입
--    - JOIN 키: (seller_nickname, title)
--      (05-product-seed.sql 의 seed_products TEMP 테이블은 COMMIT 후 사라짐)
--
--  결과 요약 (예상):
--    매핑 rows         : 101
--    매핑된 매물       : 84  (single 75 + multi 9)
--    NULL (매핑 X) 매물: 116 (기기 28 + 생활/의류/식품 ~80 + 어학·자격증 책 7)
--
--  학과별 분포:
--    통계학과(19) · 경영학과(20) · 경제학과(17) · 전기전자공학부(17)
--    컴퓨터학과(16) · 영어영문학과(9) · 심리학부(3)
--
--  멱등성:
--    - CREATE TABLE / INDEX : IF NOT EXISTS
--    - 본인 페르소나 200매물에 한정해 기존 prm row 정리 후 재삽입
--    - INSERT : ON CONFLICT (product_id, major_id) DO NOTHING (이중 안전장치)
--
--  주의:
--    - TEMP TABLE 사용 X — VALUES CTE 만 사용
--    - 옆 팀 매물 / 시드 외 매물에는 절대 영향 없음 (페르소나 nickname 화이트리스트)
--    - 단일 BEGIN/COMMIT 트랜잭션
-- ============================================================

BEGIN;


-- ============================================================
--  1. 신규 테이블 + 인덱스 (PART 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS product_related_majors (
    product_id UUID    NOT NULL REFERENCES products(pid)       ON DELETE CASCADE,
    major_id   INTEGER NOT NULL REFERENCES majors(major_id)    ON DELETE CASCADE,
    PRIMARY KEY (product_id, major_id)
);

CREATE INDEX IF NOT EXISTS idx_prm_product_id ON product_related_majors(product_id);
CREATE INDEX IF NOT EXISTS idx_prm_major_id   ON product_related_majors(major_id);

COMMENT ON TABLE  product_related_majors IS '매물-학과 다대다(M:N) 매핑. row 없음 = 학과 무관(전 학과 추천 대상)';
COMMENT ON COLUMN product_related_majors.product_id IS 'FK → products(pid), 매물 UUID';
COMMENT ON COLUMN product_related_majors.major_id   IS 'FK → majors(major_id), 관련 학과';


-- ============================================================
--  1-b. RLS — 전체 공개 읽기 (products 와 동일 패턴)
--       매핑 정보는 비공개가 아니므로 anon/authenticated 모두 SELECT 허용.
--       (이 정책 누락 시 클라이언트가 빈 배열만 받아 학과 필터가 동작하지 않음)
-- ============================================================

ALTER TABLE product_related_majors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_related_majors: 전체 공개 읽기" ON product_related_majors;
CREATE POLICY "product_related_majors: 전체 공개 읽기"
    ON product_related_majors FOR SELECT
    USING (true);


-- ============================================================
--  2. 멱등 클린업 — 본인 페르소나 200매물에 한정
--     (옆 팀 또는 다른 출처의 prm row 는 건드리지 않음)
-- ============================================================

DELETE FROM product_related_majors prm
USING products p, public.users u
WHERE prm.product_id = p.pid
  AND p.seller_uid   = u.uid
  AND u.nickname IN (
    '새내기경영민준','신입생통계서연','자취첫학기지호','새내기영문하늘','전전새내기도윤',
    '이학년통계예진','경영이학년수민','컴공이학년태현','심리이학년유나','경제이학년재현',
    '그냥사람',       '경영삼학년소희','전전삼학년민호','컴공삼학년준영','경제삼학년채원',
    '사학년통계현우','경영사학년다은','영문사학년혜진','전전사학년석진','경제사학년승현'
  );


-- ============================================================
--  3. 매핑 INSERT  — VALUES CTE → JOIN
--     - (seller_nickname, title) 키로 products.pid 해석
--     - major_name 으로 majors.major_id 해석
--     - LEFT JOIN 아닌 INNER JOIN: 매핑 누락 시 자동으로 row 생성 안 됨
-- ============================================================

WITH mapping(seller_nickname, title, major_name) AS (
    VALUES
    -- ============================================================
    --  A. 책 종류 - 학과 단일 매핑 (75건)
    -- ============================================================

    -- ── 통계학과 (14권) ─────────────────────────────────────────
    ('신입생통계서연', '통계학 입문 (한국통계학회) 4판',                  '통계학과'),
    ('신입생통계서연', '통계학 개론 (송문섭) 8판',                         '통계학과'),
    ('이학년통계예진', '수리통계학 (송문섭) 4판',                          '통계학과'),
    ('이학년통계예진', 'R을 활용한 데이터 분석 (한빛)',                    '통계학과'),
    ('이학년통계예진', '통계학원론 (한국통계학회) 6판',                    '통계학과'),
    ('그냥사람',       '수리통계학 (송문섭) 4판 + 필기 노트',              '통계학과'),
    ('그냥사람',       '베이지안 데이터 분석 (Gelman) 3rd Edition',        '통계학과'),
    ('그냥사람',       '회귀분석 (한국통계학회)',                          '통계학과'),
    ('그냥사람',       '시계열 분석 (한국통계학회)',                       '통계학과'),
    ('사학년통계현우', '확률론 (한국통계학회)',                            '통계학과'),
    ('사학년통계현우', '수리통계학 II (Casella & Berger)',                 '통계학과'),
    ('사학년통계현우', '다변량 통계분석 (Johnson) 6판',                    '통계학과'),
    ('사학년통계현우', '통계 컨설팅 입문 (자체 교재)',                     '통계학과'),
    ('사학년통계현우', '비모수 통계 (한국통계학회)',                       '통계학과'),

    -- ── 경영학과 (13권 — p153 재무관리는 B로 이동) ──────────────
    ('새내기경영민준', '경영학원론 박병호 7판',                            '경영학과'),
    ('경영이학년수민', '경영학원론 (윤재희) 3판',                          '경영학과'),
    ('경영이학년수민', '회계원리 (송인만) 7판',                            '경영학과'),
    ('경영이학년수민', '마케팅원론 (코틀러) 16판 (한역본)',                '경영학과'),
    ('경영삼학년소희', '마케팅 원론 (코틀러) 16판 (영문)',                 '경영학과'),
    ('경영삼학년소희', '소비자 행동론 (안광호) 8판',                       '경영학과'),
    ('경영삼학년소희', '디지털 마케팅 (서영조)',                           '경영학과'),
    ('경영삼학년소희', 'Strategic Brand Management (Keller) 5th',          '경영학과'),
    ('경영삼학년소희', 'HBR 마케팅 사례집 (모음판)',                       '경영학과'),
    ('경영사학년다은', '경영전략 (Barney) 5판',                            '경영학과'),
    ('경영사학년다은', '인사관리 (박원우) 6판',                            '경영학과'),
    ('경영사학년다은', '창업론 (창업기획자 교육 교재)',                    '경영학과'),
    ('경영사학년다은', '비즈니스 모델 제너레이션 (오스터왈더)',            '경영학과'),

    -- ── 경제학과 (10권 — p075/p189/p191 은 B로 이동) ────────────
    ('새내기경영민준', '미시경제학원론 (이준구) 6판',                      '경제학과'),
    ('경제이학년재현', '미시경제학 (이준구) 7판',                          '경제학과'),
    ('경제이학년재현', '통계학 (계량경제용, 김인규)',                      '경제학과'),
    ('경제삼학년채원', '거시경제학 (Romer) 5판',                           '경제학과'),
    ('경제삼학년채원', '미시경제학 (Mas-Colell)',                          '경제학과'),
    ('경제삼학년채원', '경제수학 (Chiang) 4판',                            '경제학과'),
    ('경제삼학년채원', '화폐금융론 (정운찬) 8판',                          '경제학과'),
    ('경제사학년승현', '화폐금융론 (Mishkin) 12판',                        '경제학과'),
    ('경제사학년승현', '계량경제학 (Wooldridge) 6판',                      '경제학과'),
    ('경제사학년승현', '금융시장론 (Mishkin)',                             '경제학과'),

    -- ── 전기전자공학부 (12권) ──────────────────────────────────
    ('전전새내기도윤', '회로이론 (Nilsson & Riedel) 11판',                 '전기전자공학부'),
    ('전전새내기도윤', '전자기학 (Griffiths) 4판',                         '전기전자공학부'),
    ('전전삼학년민호', '디지털 시스템 (Mano) 5판',                         '전기전자공학부'),
    ('전전삼학년민호', '신호 및 시스템 (Oppenheim) 2판',                   '전기전자공학부'),
    ('전전삼학년민호', '전기 회로 II (Nilsson) 11판',                      '전기전자공학부'),
    ('전전삼학년민호', '전자공학 실험 가이드 (자체 제작)',                 '전기전자공학부'),
    ('전전삼학년민호', '전자기학 문제집 (Schaum 시리즈)',                  '전기전자공학부'),
    ('전전사학년석진', '디지털 신호 처리 (Proakis) 4판',                   '전기전자공학부'),
    ('전전사학년석진', '통신 시스템 (Haykin) 5판',                         '전기전자공학부'),
    ('전전사학년석진', '전력 시스템 (Bergen) 2판',                         '전기전자공학부'),
    ('전전사학년석진', '마이크로프로세서 8086',                            '전기전자공학부'),
    ('전전사학년석진', '임베디드 시스템 입문 (한빛)',                      '전기전자공학부'),

    -- ── 컴퓨터학과 (11권) ──────────────────────────────────────
    ('자취첫학기지호', 'C 프로그래밍 입문 (한빛아카데미)',                 '컴퓨터학과'),
    ('자취첫학기지호', '자료구조 (생능출판) 3판',                          '컴퓨터학과'),
    ('컴공이학년태현', '알고리즘 문제 해결 전략 (구종만)',                 '컴퓨터학과'),
    ('컴공이학년태현', '자료구조와 알고리즘 (한빛아카데미)',               '컴퓨터학과'),
    ('컴공이학년태현', '운영체제 (Silberschatz 공룡책) 10판',              '컴퓨터학과'),
    ('컴공이학년태현', '데이터베이스 시스템 (Elmasri) 7판',                '컴퓨터학과'),
    ('컴공삼학년준영', '운영체제 II (Tanenbaum) 4판',                      '컴퓨터학과'),
    ('컴공삼학년준영', '컴파일러 (Aho) 2판',                               '컴퓨터학과'),
    ('컴공삼학년준영', '컴퓨터구조 (Patterson) 5판',                       '컴퓨터학과'),
    ('컴공삼학년준영', '게임 프로그래밍 패턴',                             '컴퓨터학과'),
    ('컴공삼학년준영', 'Unity 게임 개발 입문 (한빛)',                      '컴퓨터학과'),

    -- ── 영어영문학과 (9권) ────────────────────────────────────
    ('새내기영문하늘', '영문학 입문 — Norton Introduction',                '영어영문학과'),
    ('새내기영문하늘', 'Cambridge Interchange 4th Edition (Level 3)',      '영어영문학과'),
    ('새내기영문하늘', '옥스포드 영영사전 9판',                            '영어영문학과'),
    ('새내기영문하늘', 'Norton 영문 에세이집 (저자별 모음)',               '영어영문학과'),
    ('영문사학년혜진', '영문학사 (한국영어영문학회)',                      '영어영문학과'),
    ('영문사학년혜진', '영어 음성학 (Roach) 4판',                          '영어영문학과'),
    ('영문사학년혜진', '셰익스피어 강독 (Norton Anthology)',               '영어영문학과'),
    ('영문사학년혜진', '19세기 영문학 강독 (자체 교재)',                   '영어영문학과'),
    ('영문사학년혜진', 'Cambridge Interchange 4th (Level 4)',              '영어영문학과'),

    -- ── 심리학부 (3권) ────────────────────────────────────────
    ('심리이학년유나', '일반심리학 (양돈규) 4판',                          '심리학부'),
    ('심리이학년유나', '인지심리학 (이정모) 3판',                          '심리학부'),
    ('심리이학년유나', '사회심리학 (한규석) 4판',                          '심리학부'),


    -- ============================================================
    --  E. 학과 단체용 / 도구 (single, 3건)
    -- ============================================================
    ('이학년통계예진', '통계학회 단체티 (M, 네이비)',                     '통계학과'),       -- F p045
    ('경영이학년수민', '경영전략학회 자료집 2025 (자체 제작)',            '경영학과'),       -- F p051
    ('전전새내기도윤', '납땜인두 입문 키트 (60W 디지털)',                 '전기전자공학부'), -- E p032


    -- ============================================================
    --  B. 책 다중 학과 매핑 (이전 NULL → multi)
    -- ============================================================

    -- p010 교양수학 — 미적분과 선형대수의 기초 → [통계, 컴공, 전전, 경제]
    ('신입생통계서연', '교양수학 — 미적분과 선형대수의 기초',              '통계학과'),
    ('신입생통계서연', '교양수학 — 미적분과 선형대수의 기초',              '컴퓨터학과'),
    ('신입생통계서연', '교양수학 — 미적분과 선형대수의 기초',              '전기전자공학부'),
    ('신입생통계서연', '교양수학 — 미적분과 선형대수의 기초',              '경제학과'),

    -- p031 일반물리학 (Halliday) → [전전, 컴공]
    ('전전새내기도윤', '일반물리학 (Halliday) 11판',                       '전기전자공학부'),
    ('전전새내기도윤', '일반물리학 (Halliday) 11판',                       '컴퓨터학과'),

    -- p075 거시경제학 (만큐) → [경제, 경영]
    ('경제이학년재현', '거시경제학 (만큐) 11판',                           '경제학과'),
    ('경제이학년재현', '거시경제학 (만큐) 11판',                           '경영학과'),

    -- p088 파이썬 데이터 사이언스 핸드북 → [통계, 컴공]
    ('그냥사람',       '파이썬 데이터 사이언스 핸드북',                    '통계학과'),
    ('그냥사람',       '파이썬 데이터 사이언스 핸드북',                    '컴퓨터학과'),

    -- p153 재무관리 (Brealey) 13판 → [경영, 경제]  (NEW — 사용자 추가)
    ('경영사학년다은', '재무관리 (Brealey) 13판',                          '경영학과'),
    ('경영사학년다은', '재무관리 (Brealey) 13판',                          '경제학과'),

    -- p189 금융경제학 (Bodie) 11판 → [경제, 경영]  (NEW)
    ('경제사학년승현', '금융경제학 (Bodie) 11판',                          '경제학과'),
    ('경제사학년승현', '금융경제학 (Bodie) 11판',                          '경영학과'),

    -- p191 국제금융 (Krugman) 10판 → [경제, 경영]  (NEW)
    ('경제사학년승현', '국제금융 (Krugman) 10판',                          '경제학과'),
    ('경제사학년승현', '국제금융 (Krugman) 10판',                          '경영학과'),


    -- ============================================================
    --  E. 카시오 공학용 계산기 → [통계, 컴공, 전전, 경제, 경영]
    -- ============================================================

    -- p077 카시오 FX-991EX
    ('경제이학년재현', '카시오 공학용 계산기 FX-991EX',                   '통계학과'),
    ('경제이학년재현', '카시오 공학용 계산기 FX-991EX',                   '컴퓨터학과'),
    ('경제이학년재현', '카시오 공학용 계산기 FX-991EX',                   '전기전자공학부'),
    ('경제이학년재현', '카시오 공학용 계산기 FX-991EX',                   '경제학과'),
    ('경제이학년재현', '카시오 공학용 계산기 FX-991EX',                   '경영학과'),

    -- p137 카시오 FX-570ES
    ('경제삼학년채원', '카시오 공학용 계산기 FX-570ES',                   '통계학과'),
    ('경제삼학년채원', '카시오 공학용 계산기 FX-570ES',                   '컴퓨터학과'),
    ('경제삼학년채원', '카시오 공학용 계산기 FX-570ES',                   '전기전자공학부'),
    ('경제삼학년채원', '카시오 공학용 계산기 FX-570ES',                   '경제학과'),
    ('경제삼학년채원', '카시오 공학용 계산기 FX-570ES',                   '경영학과')

    -- ── NULL 매물 (row 미삽입, 116건) ──
    --   C. 기기      (28건) : 노트북·태블릿·이어폰·헤드폰·카메라·스마트폰
    --   D. 생활/의류/식품 : 침구·가구·주방·청소·상의·하의·가방·식품 등
    --   어학·자격증 책 (7건):
    --     p003 데일 카네기 인간관계론, p156 해커스 토익 보카북,
    --     p169 해커스 TEPS, p170 ETS 토익 RC, p194 ETS 토익 LC,
    --     p193 CFA Level 1 SchweserNotes
)
INSERT INTO product_related_majors (product_id, major_id)
SELECT p.pid, m.major_id
FROM   mapping       mp
JOIN   public.users  u ON u.nickname   = mp.seller_nickname
JOIN   products      p ON p.seller_uid = u.uid
                       AND p.title      = mp.title
                       AND p.deleted_at IS NULL
JOIN   majors        m ON m.name        = mp.major_name
ON CONFLICT (product_id, major_id) DO NOTHING;


-- ============================================================
--  4. 사후 검증 — 매핑 row 수가 기대치 (101) 와 일치하는지 확인
--     (mismatch 시 트랜잭션 자동 롤백)
-- ============================================================

DO $$
DECLARE
    v_persona_uids UUID[];
    v_inserted     INT;
    v_expected     INT := 101;
BEGIN
    SELECT ARRAY_AGG(uid) INTO v_persona_uids
    FROM public.users
    WHERE nickname IN (
        '새내기경영민준','신입생통계서연','자취첫학기지호','새내기영문하늘','전전새내기도윤',
        '이학년통계예진','경영이학년수민','컴공이학년태현','심리이학년유나','경제이학년재현',
        '그냥사람',       '경영삼학년소희','전전삼학년민호','컴공삼학년준영','경제삼학년채원',
        '사학년통계현우','경영사학년다은','영문사학년혜진','전전사학년석진','경제사학년승현'
    );

    SELECT COUNT(*) INTO v_inserted
    FROM product_related_majors prm
    JOIN products p ON p.pid = prm.product_id
    WHERE p.seller_uid = ANY(v_persona_uids);

    IF v_inserted <> v_expected THEN
        RAISE EXCEPTION
          '매핑 row 수 mismatch: expected=%, actual=%. 시드 매물 누락 또는 title drift 가능성. 본인 매물 200개가 모두 INSERT 되어 있는지 확인.',
          v_expected, v_inserted;
    END IF;
END $$;


COMMIT;


-- ============================================================
--  검증 쿼리 (실행 후 수동 확인)
-- ============================================================

-- ── (1) 신규 테이블 + 인덱스 존재 확인 ──────────────────────
-- SELECT table_name FROM information_schema.tables
-- WHERE  table_schema = 'public' AND table_name = 'product_related_majors';
--
-- SELECT indexname FROM pg_indexes
-- WHERE  tablename = 'product_related_majors'
-- ORDER  BY indexname;


-- ── (2) 매물별 학과 분포 (기대값: 0=116, 1=75, 2=6, 4=1, 5=2) ─
-- WITH persona_uids AS (
--   SELECT uid FROM public.users WHERE nickname IN (
--     '새내기경영민준','신입생통계서연','자취첫학기지호','새내기영문하늘','전전새내기도윤',
--     '이학년통계예진','경영이학년수민','컴공이학년태현','심리이학년유나','경제이학년재현',
--     '그냥사람',       '경영삼학년소희','전전삼학년민호','컴공삼학년준영','경제삼학년채원',
--     '사학년통계현우','경영사학년다은','영문사학년혜진','전전사학년석진','경제사학년승현'
--   )
-- ), per_product AS (
--   SELECT p.pid, COUNT(prm.major_id) AS major_count
--   FROM   products p
--   LEFT JOIN product_related_majors prm ON prm.product_id = p.pid
--   WHERE  p.seller_uid IN (SELECT uid FROM persona_uids)
--   GROUP  BY p.pid
-- )
-- SELECT major_count, COUNT(*) AS product_count
-- FROM   per_product
-- GROUP  BY major_count
-- ORDER  BY major_count;


-- ── (3) 학과별 매물 수 (다중 매핑 포함, 기대 합 = 101) ───────
-- SELECT m.name, m.college, COUNT(*) AS product_count
-- FROM   product_related_majors prm
-- JOIN   majors   m ON m.major_id    = prm.major_id
-- JOIN   products p ON p.pid         = prm.product_id
-- JOIN   public.users u ON u.uid     = p.seller_uid
-- WHERE  u.nickname IN (
--   '새내기경영민준','신입생통계서연','자취첫학기지호','새내기영문하늘','전전새내기도윤',
--   '이학년통계예진','경영이학년수민','컴공이학년태현','심리이학년유나','경제이학년재현',
--   '그냥사람',       '경영삼학년소희','전전삼학년민호','컴공삼학년준영','경제삼학년채원',
--   '사학년통계현우','경영사학년다은','영문사학년혜진','전전사학년석진','경제사학년승현'
-- )
-- GROUP  BY m.name, m.college
-- ORDER  BY product_count DESC, m.name;


-- ── (4) 페르소나 #11 (그냥사람, 통계 3학년) 추천 매물 시뮬레이션 ─
--    옆 팀 앱 로직과 동일한 패턴:
--    "통계학과 매핑 매물 + NULL(매핑 없는) 매물"
--
-- WITH target_user AS (
--   SELECT u.uid AS my_uid, m.major_id AS my_major
--   FROM   public.users u
--   JOIN   majors m ON m.name = '통계학과'
--   WHERE  u.nickname = '그냥사람'
--   LIMIT  1
-- )
-- SELECT p.pid, p.title, p.price, p.status,
--        CASE
--          WHEN EXISTS (SELECT 1 FROM product_related_majors WHERE product_id = p.pid)
--            THEN '학과 매핑 (통계 포함)'
--          ELSE '학과 무관 (NULL)'
--        END AS match_kind
-- FROM   products p
-- CROSS  JOIN target_user t
-- WHERE  p.deleted_at IS NULL
--   AND  p.seller_uid <> t.my_uid                        -- 자기 매물 제외
--   AND (
--         p.pid IN (SELECT product_id FROM product_related_majors WHERE major_id = t.my_major)
--      OR p.pid NOT IN (SELECT product_id FROM product_related_majors)
--       )
-- ORDER  BY p.created_at DESC;
--
--   기대: 통계학과 매핑 매물 (통계학회 단체티·교양수학·파이썬·카시오 포함)
--        + 기기·생활용품·의류·식품 등 NULL 매물.
--   p031 일반물리학(Halliday): multi 매핑(전전+컴공)이라 통계 사용자는 더 이상 추천받지 않음.
